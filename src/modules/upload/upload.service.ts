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
import { VerifyUploadResponse, UploadUrlResponse } from './upload.types';
import {
  PRESIGNED_GET_EXPIRY_SECONDS,
  PRESIGNED_PUT_EXPIRY_SECONDS,
  CLEANUP_AGE_HOURS,
  S3_DELETE_BATCH_SIZE,
} from './upload.constants';
import { withRetry, isS3ClientError, chunkArray } from '../../shared/utils/retry';
import { NotFoundError } from '../../shared/errors';

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

  private async _generatePresignedPutUrl(
    key: string,
    mimeType: string,
  ): Promise<{ uploadUrl: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    const uploadUrl = await withRetry(() =>
      getSignedUrl(this.s3, command, { expiresIn: PRESIGNED_PUT_EXPIRY_SECONDS }),
    );

    return { uploadUrl };
  }

  private async _verifyAndGetPresignedGetUrl(key: string): Promise<{ viewUrl: string }> {
    try {
      await withRetry(() => this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key })));
    } catch (err: unknown) {
      if (isS3ClientError(err) && err.$metadata.httpStatusCode === 404) {
        throw new NotFoundError('File not found in storage. Please upload again.');
      }
      throw err;
    }

    const viewUrl = await withRetry(() =>
      getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
        expiresIn: PRESIGNED_GET_EXPIRY_SECONDS,
      }),
    );

    return { viewUrl };
  }

  async generateUploadUrlForKey(key: string, mimeType: string): Promise<UploadUrlResponse> {
    const { uploadUrl } = await this._generatePresignedPutUrl(key, mimeType);

    this.logger.info({
      action: 'UPLOAD_URL_GENERATED',
      module: 'upload',
      key,
      mimeType,
    });

    return { uploadUrl, key, expiresIn: PRESIGNED_PUT_EXPIRY_SECONDS };
  }

  async verifyUploadByKey(key: string): Promise<VerifyUploadResponse> {
    const { viewUrl } = await this._verifyAndGetPresignedGetUrl(key);

    this.logger.info({
      action: 'UPLOAD_VERIFIED',
      module: 'upload',
      key,
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
