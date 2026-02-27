export function isS3ClientError(err: unknown): err is { $metadata: { httpStatusCode?: number } } {
  return typeof err === 'object' && err !== null && '$metadata' in err;
}

export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      // Do not retry 4xx errors — they indicate a client-side problem
      if (isS3ClientError(err)) {
        const status = err.$metadata.httpStatusCode;
        if (status !== undefined && status >= 400 && status < 500) {
          throw err;
        }
      }

      lastError = err as Error;

      if (attempt < maxAttempts) {
        const delayMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
