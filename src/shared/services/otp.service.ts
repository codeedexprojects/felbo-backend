import { Logger } from 'winston';
import { getRedisClient } from '../redis/redis';
import { config } from '../config/config.service';
import { AppError, ServiceUnavailableError, TooManyRequestsError } from '../errors/index';

export type OtpFlowType = 'USER' | 'VENDOR';

export interface SendOtpResult {
  sessionId: string;
}

export interface VerifyOtpResult {
  verified: boolean;
}

interface TwoFactorApiResponse {
  Status: string;
  Details: string;
}

const DAILY_CAP_TTL = 86400; // 24 hours
const VERIFY_CAP_TTL = 300; // 5 minutes
const VERIFY_MAX_ATTEMPTS = 500;

function getDailyLimit(flowType: OtpFlowType): number {
  return flowType === 'USER' ? config.otp.dailyLimitUser : config.otp.dailyLimitVendor;
}

export class TwoFactorOtpService {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://2factor.in/API/V1';

  constructor(
    private readonly logger: Logger,
    apiKey: string,
  ) {
    if (!apiKey) {
      throw new Error('TWO_FACTOR_API_KEY is required for TwoFactorOtpService');
    }
    this.apiKey = apiKey;
  }

  async sendOtp(phone: string, flowType: OtpFlowType): Promise<SendOtpResult> {
    const redis = getRedisClient();
    const dailyKey = `otp:daily:${phone}`;

    const count = await redis.incr(dailyKey);
    if (count === 1) {
      await redis.expire(dailyKey, DAILY_CAP_TTL);
    }

    const limit = getDailyLimit(flowType);
    if (count > limit) {
      throw new TooManyRequestsError('OTP limit reached. Please try again tomorrow.');
    }

    const url = `${this.baseUrl}/${this.apiKey}/SMS/${phone}/AUTOGEN`;

    try {
      const response = await fetch(url);
      const data = (await response.json()) as TwoFactorApiResponse;

      if (data.Status !== 'Success') {
        this.logger.error('2Factor send OTP failed', {
          phone: phone.slice(-4),
          response: data,
        });
        throw new ServiceUnavailableError('Failed to send OTP. Please try again.');
      }

      this.logger.info('OTP sent successfully', {
        phone: phone.slice(-4),
        sessionId: data.Details,
      });

      return { sessionId: data.Details };
    } catch (error) {
      if (error instanceof AppError) throw error;

      this.logger.error('2Factor API error', { error });
      throw new ServiceUnavailableError('OTP service is temporarily unavailable.');
    }
  }

  async verifyOtp(sessionId: string, otp: string): Promise<VerifyOtpResult> {
    const redis = getRedisClient();
    const verifyKey = `otp:verify:${sessionId}`;

    const count = await redis.incr(verifyKey);
    if (count === 1) {
      await redis.expire(verifyKey, VERIFY_CAP_TTL);
    }

    if (count > VERIFY_MAX_ATTEMPTS) {
      throw new TooManyRequestsError('Too many attempts. Please request a new OTP.');
    }

    const url = `${this.baseUrl}/${this.apiKey}/SMS/VERIFY/${sessionId}/${otp}`;

    try {
      const response = await fetch(url);
      const data = (await response.json()) as TwoFactorApiResponse;

      if (data.Status === 'Success' && data.Details === 'OTP Matched') {
        this.logger.info('OTP verified successfully', { sessionId });
        await redis.del(verifyKey);
        return { verified: true };
      }

      this.logger.warn('OTP verification failed', { sessionId, response: data });
      return { verified: false };
    } catch (error) {
      if (error instanceof AppError) throw error;

      this.logger.error('2Factor verify API error', { error });
      throw new ServiceUnavailableError('OTP verification service is temporarily unavailable.');
    }
  }
}

export class DevOtpService {
  private readonly fixedOtp: string;

  constructor(
    private readonly logger: Logger,
    fixedOtp: string = '123456',
  ) {
    this.fixedOtp = fixedOtp;
  }

  async sendOtp(phone: string, flowType: OtpFlowType): Promise<SendOtpResult> {
    const redis = getRedisClient();
    const dailyKey = `otp:daily:${phone}`;

    const count = await redis.incr(dailyKey);
    if (count === 1) {
      await redis.expire(dailyKey, DAILY_CAP_TTL);
    }

    const limit = getDailyLimit(flowType);
    if (count > limit) {
      throw new TooManyRequestsError('OTP limit reached. Please try again tomorrow.');
    }

    const sessionId = `dev-session-${Date.now()}`;

    this.logger.info('[DEV] OTP sent', {
      phone: phone.slice(-4),
      otp: this.fixedOtp,
      sessionId,
    });

    return { sessionId };
  }

  async verifyOtp(sessionId: string, otp: string): Promise<VerifyOtpResult> {
    const redis = getRedisClient();
    const verifyKey = `otp:verify:${sessionId}`;

    const count = await redis.incr(verifyKey);
    if (count === 1) {
      await redis.expire(verifyKey, VERIFY_CAP_TTL);
    }

    if (count > VERIFY_MAX_ATTEMPTS) {
      throw new TooManyRequestsError('Too many attempts. Please request a new OTP.');
    }

    const verified = otp === this.fixedOtp;

    this.logger.info('[DEV] OTP verification', {
      sessionId,
      verified,
    });

    if (verified) {
      await redis.del(verifyKey);
    }

    return { verified };
  }
}

export type OtpService = TwoFactorOtpService | DevOtpService;
