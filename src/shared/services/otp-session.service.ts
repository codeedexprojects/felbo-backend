import { getRedisClient, RedisClientType } from '../redis/redis';
import { UnauthorizedError } from '../errors/index';

const OTP_SESSION_PREFIX = 'otp-session:';
const OTP_SESSION_TTL_SECONDS = 600; // 10 minutes

interface OtpSessionData {
  phone: string;
  createdAt: number;
}

export class OtpSessionService {
  private get redis(): RedisClientType {
    return getRedisClient();
  }

  async storeSession(sessionId: string, phone: string): Promise<void> {
    const data: OtpSessionData = {
      phone,
      createdAt: Date.now(),
    };

    await this.redis.set(`${OTP_SESSION_PREFIX}${sessionId}`, JSON.stringify(data), {
      EX: OTP_SESSION_TTL_SECONDS,
    });
  }

  async verifySessionPhone(sessionId: string, phone: string): Promise<void> {
    const raw = await this.redis.get(`${OTP_SESSION_PREFIX}${sessionId}`);

    if (!raw) {
      throw new UnauthorizedError('OTP session expired. Please request a new OTP.');
    }

    const data: OtpSessionData = JSON.parse(raw);

    if (data.phone !== phone) {
      throw new UnauthorizedError('Invalid OTP. Please try again.');
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.redis.del(`${OTP_SESSION_PREFIX}${sessionId}`);
  }
}
