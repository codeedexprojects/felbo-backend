import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger } from 'winston';
import VendorService from '../vendor/vendor.service';
import {
  GenerateUploadUrlInput,
  GenerateUploadUrlResponse,
  VerifyUploadInput,
  VerifyUploadResponse,
} from './upload.types';
import {
  MIME_TO_EXT,
  PRESIGNED_GET_EXPIRY_SECONDS,
  PRESIGNED_PUT_EXPIRY_SECONDS,
  CLEANUP_AGE_HOURS,
  S3_DELETE_BATCH_SIZE,
  S3_VENDORS_PREFIX,
} from './upload.constants';
import { withRetry, isS3ClientError, chunkArray } from '@shared/utils/retry';
import { ValidationError, NotFoundError } from '@shared/errors';

export default class UploadService {
  private readonly s3: S3Client;

  constructor(
    private readonly vendorService: VendorService,
    private readonly bucket: string,
    region: string,
    private readonly logger: Logger,
  ) {
    this.s3 = new S3Client({ region });
  }

  async generateUploadUrl(input: GenerateUploadUrlInput): Promise<GenerateUploadUrlResponse> {
    const ext = MIME_TO_EXT[input.mimeType];
    const key = `${S3_VENDORS_PREFIX}${input.vendorId}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: input.mimeType,
    });

    const uploadUrl = await withRetry(() =>
      getSignedUrl(this.s3, command, { expiresIn: PRESIGNED_PUT_EXPIRY_SECONDS }),
    );

    this.logger.info({
      action: 'UPLOAD_URL_GENERATED',
      module: 'upload',
      vendorId: input.vendorId,
      key,
      mimeType: input.mimeType,
    });

    return { uploadUrl, key, expiresIn: PRESIGNED_PUT_EXPIRY_SECONDS };
  }

  async verifyUpload(input: VerifyUploadInput): Promise<VerifyUploadResponse> {
    const expectedPrefix = `vendors/${input.vendorId}/`;
    if (!input.key.startsWith(expectedPrefix)) {
      throw new ValidationError('Invalid key: does not belong to this vendor.');
    }

    try {
      await withRetry(() =>
        this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: input.key })),
      );
    } catch (err: unknown) {
      if (isS3ClientError(err) && err.$metadata.httpStatusCode === 404) {
        throw new NotFoundError('File not found in storage. Please upload again.');
      }
      throw err;
    }

    const viewUrl = await withRetry(() =>
      getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: input.key }), {
        expiresIn: PRESIGNED_GET_EXPIRY_SECONDS,
      }),
    );

    this.logger.info({
      action: 'UPLOAD_VERIFIED',
      module: 'upload',
      vendorId: input.vendorId,
      key: input.key,
    });

    return { verified: true, viewUrl };
  }

  async runCleanupJob(): Promise<void> {
    this.logger.info({ action: 'CLEANUP_JOB_STARTED', module: 'upload' });

    try {
      const [s3Objects, dbKeys] = await Promise.all([
        this.listAllS3Objects(),
        this.vendorService.getAllPhotoKeys(),
      ]);

      const dbKeySet = new Set(dbKeys);
      const cutoff = new Date(Date.now() - CLEANUP_AGE_HOURS * 60 * 60 * 1000);

      const toDelete = s3Objects
        .filter((obj) => !dbKeySet.has(obj.key) && obj.lastModified < cutoff)
        .map((obj) => ({ Key: obj.key }));

      if (toDelete.length === 0) {
        this.logger.info({
          action: 'CLEANUP_JOB_COMPLETED',
          module: 'upload',
          deletedCount: 0,
          message: 'No orphaned objects found',
        });
        return;
      }

      const batches = chunkArray(toDelete, S3_DELETE_BATCH_SIZE);
      let deletedCount = 0;

      for (const batch of batches) {
        await withRetry(() =>
          this.s3.send(
            new DeleteObjectsCommand({
              Bucket: this.bucket,
              Delete: { Objects: batch, Quiet: true },
            }),
          ),
        );
        deletedCount += batch.length;
      }

      this.logger.info({
        action: 'CLEANUP_JOB_COMPLETED',
        module: 'upload',
        deletedCount,
      });
    } catch (err) {
      this.logger.error({
        action: 'CLEANUP_JOB_FAILED',
        module: 'upload',
        error: (err as Error).message,
      });
    }
  }

  private async listAllS3Objects(): Promise<{ key: string; lastModified: Date }[]> {
    const results: { key: string; lastModified: Date }[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await withRetry(() =>
        this.s3.send(
          new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: 'vendors/',
            ContinuationToken: continuationToken,
          }),
        ),
      );

      for (const obj of response.Contents ?? []) {
        if (obj.Key && obj.LastModified) {
          results.push({ key: obj.Key, lastModified: obj.LastModified });
        }
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return results;
  }
}
