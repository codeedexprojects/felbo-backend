export interface UserDto {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  profileUrl: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
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
  profileUrl: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  walletBalance: number;
}

export interface UpdateProfileInput {
  name?: string;
  email?: string;
  profileUrl?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
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
  refreshToken: string;
  isNewUser: boolean;
  user: {
    id: string;
    phone: string;
    name: string;
    email: string | null;
    profileUrl: string | null;
    gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
    walletBalance: number;
  };
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}
