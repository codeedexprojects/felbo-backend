import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import * as googleTTS from 'google-tts-api';
import { config } from '../config/config.service';
import { logger } from '../logger/logger';

const TTS_S3_PREFIX = 'tts/';
const TTS_URL_TTL_SECONDS = 10 * 60; // 10 minutes

const s3 = new S3Client({ region: config.aws.region });

export interface TtsResult {
  audioUrl: string;
}

export async function synthesiseMalayalamSpeech(text: string): Promise<TtsResult> {
  // google-tts-api splits long text into chunks automatically.
  // getAllAudioUrls returns an array of Google Translate TTS URLs.

  const urls = googleTTS.getAllAudioUrls(text, {
    lang: 'ml',
    slow: false,
    host: 'https://translate.google.com',
  });

  // Fetch and concatenate all audio chunks into one buffer.
  // For short booking texts (< 200 chars) this will always be a single chunk.
  const buffers: Buffer[] = [];

  for (const item of urls) {
    const response = await fetch(item.url, {
      headers: {
        // Google Translate requires a browser-like user agent
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch TTS audio: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    buffers.push(Buffer.from(arrayBuffer));
  }

  const audioBuffer = Buffer.concat(buffers);

  // Upload to S3. S3 lifecycle rule on tts/ prefix deletes after 1 day.
  const s3Key = `${TTS_S3_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`;

  await s3.send(
    new PutObjectCommand({
      Bucket: config.aws.bucket,
      Key: s3Key,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
    }),
  );

  const audioUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: config.aws.bucket, Key: s3Key }),
    { expiresIn: TTS_URL_TTL_SECONDS },
  );

  logger.info('TTS audio generated and uploaded', {
    s3Key,
    textLength: text.length,
    chunks: urls.length,
  });

  return { audioUrl };
}

export function buildBookingTtsText(): string {
  return `പുതിയ ബുക്കിംഗ് സ്ഥിരീകരിച്ചു.`;
}
