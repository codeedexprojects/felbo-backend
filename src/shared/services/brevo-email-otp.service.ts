import { Logger } from 'winston';
import crypto from 'crypto';
import { getRedisClient } from '../redis/redis';
import {
  AppError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
} from '../errors/index';

const DAILY_CAP_TTL = 86400;
const DAILY_LIMIT = 10;
const IP_LIMIT = 20;
const IP_TTL = 3600;
const OTP_TTL = 600;
const VERIFY_MAX_ATTEMPTS = 5;

export interface BrevoSendOtpResult {
  message: string;
}

export interface BrevoVerifyOtpResult {
  verified: boolean;
}

function generateOtp(): string {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

export class BrevoEmailOtpService {
  constructor(
    private readonly logger: Logger,
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string,
  ) {
    if (!apiKey) {
      throw new Error('BREVO_API_KEY is required for BrevoEmailOtpService');
    }
  }

  async sendOtp(email: string, clientIp: string): Promise<BrevoSendOtpResult> {
    const redis = getRedisClient();

    const ipKey = `barber-otp-ip:${clientIp}`;
    const ipCount = await redis.incr(ipKey);
    if (ipCount === 1) await redis.expire(ipKey, IP_TTL);
    if (ipCount > IP_LIMIT) {
      throw new TooManyRequestsError('Too many OTP requests from this IP. Please try again later.');
    }

    const dailyKey = `barber-otp-daily:${email}`;
    const count = await redis.incr(dailyKey);
    if (count === 1) await redis.expire(dailyKey, DAILY_CAP_TTL);
    if (count > DAILY_LIMIT) {
      throw new TooManyRequestsError('OTP limit reached. Please try again tomorrow.');
    }

    const otp = generateOtp();

    // Store OTP in Redis
    const otpKey = `barber-email-otp:${email}`;
    await redis.set(otpKey, otp, { EX: OTP_TTL });

    // Reset attempt counter when new OTP is sent
    const attemptsKey = `barber-otp-attempts:${email}`;
    await redis.del(attemptsKey);

    // Send email via Brevo transactional API
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { name: this.fromName, email: this.fromEmail },
          to: [{ email }],
          subject: 'Your Felbo Login OTP',
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
              <h2 style="color: #1a1a2e;">Your Felbo OTP</h2>
              <p>Use the following one-time password to verify your identity:</p>
              <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #e94560; margin: 24px 0;">
                ${otp}
              </div>
              <p style="color: #666; font-size: 14px;">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.warn('Brevo API rejected OTP send', {
          email: email.slice(-6),
          status: response.status,
          brevoError: errorBody,
        });
        throw new ServiceUnavailableError('Failed to send OTP email. Please try again.');
      }

      this.logger.info('Barber OTP email sent', { email: email.slice(-6) });

      return { message: 'OTP sent to your email.' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      this.logger.error('Brevo API error', { error });
      throw new ServiceUnavailableError('Email OTP service is temporarily unavailable.');
    }
  }

  async verifyOtp(email: string, otp: string): Promise<BrevoVerifyOtpResult> {
    const redis = getRedisClient();

    // Check attempt cap
    const attemptsKey = `barber-otp-attempts:${email}`;
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) {
      await redis.expire(attemptsKey, OTP_TTL);
    }
    if (attempts > VERIFY_MAX_ATTEMPTS) {
      throw new TooManyRequestsError('Too many attempts. Please request a new OTP.');
    }

    const otpKey = `barber-email-otp:${email}`;
    const stored = await redis.get(otpKey);

    if (!stored) {
      throw new UnauthorizedError('OTP has expired. Please request a new one.');
    }

    if (stored.length !== otp.length) {
      this.logger.warn('Barber OTP mismatch', { email: email.slice(-6) });
      return { verified: false };
    }

    const isMatch = crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(otp));
    if (!isMatch) {
      this.logger.warn('Barber OTP mismatch', { email: email.slice(-6) });
      return { verified: false };
    }

    // OTP matched — clean up
    await redis.del(otpKey);
    await redis.del(attemptsKey);

    this.logger.info('Barber OTP verified', { email: email.slice(-6) });
    return { verified: true };
  }
}

export class DevBrevoEmailOtpService {
  private readonly fixedOtp: string;

  constructor(
    private readonly logger: Logger,
    fixedOtp: string = '123456',
  ) {
    this.fixedOtp = fixedOtp;
  }

  async sendOtp(email: string, _clientIp: string): Promise<BrevoSendOtpResult> {
    const redis = getRedisClient();

    const dailyKey = `barber-otp-daily:${email}`;
    const count = await redis.incr(dailyKey);
    if (count === 1) await redis.expire(dailyKey, DAILY_CAP_TTL);
    if (count > DAILY_LIMIT) {
      throw new TooManyRequestsError('OTP limit reached. Please try again tomorrow.');
    }

    const otpKey = `barber-email-otp:${email}`;
    await redis.set(otpKey, this.fixedOtp, { EX: OTP_TTL });

    const attemptsKey = `barber-otp-attempts:${email}`;
    await redis.del(attemptsKey);

    this.logger.info('[DEV] Barber email OTP sent', { email: email.slice(-6), otp: this.fixedOtp });

    return { message: 'OTP sent to your email.' };
  }

  async verifyOtp(email: string, otp: string): Promise<BrevoVerifyOtpResult> {
    const redis = getRedisClient();

    const attemptsKey = `barber-otp-attempts:${email}`;
    const attempts = await redis.incr(attemptsKey);
    if (attempts === 1) {
      await redis.expire(attemptsKey, OTP_TTL);
    }
    if (attempts > VERIFY_MAX_ATTEMPTS) {
      throw new TooManyRequestsError('Too many attempts. Please request a new OTP.');
    }

    const otpKey = `barber-email-otp:${email}`;
    const stored = await redis.get(otpKey);

    if (!stored) {
      throw new UnauthorizedError('OTP has expired. Please request a new one.');
    }

    if (stored !== otp) {
      this.logger.warn('[DEV] Barber OTP mismatch', { email: email.slice(-6) });
      return { verified: false };
    }

    await redis.del(otpKey);
    await redis.del(attemptsKey);

    this.logger.info('[DEV] Barber OTP verified', { email: email.slice(-6) });
    return { verified: true };
  }
}

export type BarberEmailOtpService = BrevoEmailOtpService | DevBrevoEmailOtpService;
