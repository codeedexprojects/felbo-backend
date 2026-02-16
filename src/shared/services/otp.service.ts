import { Logger } from 'winston';
import { AppError, ServiceUnavailableError } from '../errors/index';

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

  async sendOtp(phone: string): Promise<SendOtpResult> {
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
    const url = `${this.baseUrl}/${this.apiKey}/SMS/VERIFY/${sessionId}/${otp}`;

    try {
      const response = await fetch(url);
      const data = (await response.json()) as TwoFactorApiResponse;

      if (data.Status === 'Success' && data.Details === 'OTP Matched') {
        this.logger.info('OTP verified successfully', { sessionId });
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

  sendOtp(phone: string): SendOtpResult {
    const sessionId = `dev-session-${Date.now()}`;

    this.logger.info('[DEV] OTP sent', {
      phone: phone.slice(-4),
      otp: this.fixedOtp,
      sessionId,
    });

    return { sessionId };
  }

  verifyOtp(sessionId: string, otp: string): VerifyOtpResult {
    const verified = otp === this.fixedOtp;

    this.logger.info('[DEV] OTP verification', {
      sessionId,
      verified,
    });

    return { verified };
  }
}

export type OtpService = TwoFactorOtpService | DevOtpService;
