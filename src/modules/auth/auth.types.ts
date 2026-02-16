export interface SendOtpInput {
  phone: string;
}

export interface VerifyOtpInput {
  phone: string;
  otp: string;
  sessionId: string;
}

export interface SendOtpResponse {
  sessionId: string;
  message: string;
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
