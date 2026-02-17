export interface UserDto {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  walletBalance: number;
  cancellationCount: number;
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  lastLoginAt: Date | null;
  createdAt: Date;
}

export interface UserProfileDto {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  walletBalance: number;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

export interface SendOtpInput {
  phone: string;
}

export interface SendOtpResponse {
  sessionId: string;
  message: string;
}

export interface VerifyOtpInput {
  phone: string;
  otp: string;
  sessionId: string;
}

export interface VerifyOtpResponse {
  token: string;
  isNewUser: boolean;
  user: {
    id: string;
    phone: string;
    name: string;
    email: string | null;
    walletBalance: number;
  };
}
