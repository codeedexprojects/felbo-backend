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

// ─── Admin user management ───────────────────────────────────────────────────

export interface ListUsersFilter {
  search?: string;
  status?: 'ACTIVE' | 'BLOCKED';
  page: number;
  limit: number;
}

export interface UserListItemDto {
  slNo: number;
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  walletBalance: number;
  cancellationCount: number;
  lastLoginAt: Date | null;
  registeredAt: Date;
}

export interface UserStatusCounts {
  total: number;
  active: number;
  blocked: number;
}

export interface ListUsersResponse {
  users: UserListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: UserStatusCounts;
}

export interface UserIssueDto {
  id: string;
  type: string;
  description: string;
  status: string;
  createdAt: Date;
}

export interface UserDetailDto {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  blockReason: string | null;
  walletBalance: number;
  cancellationCount: number;
  registeredAt: Date;
  lastLoginAt: Date | null;
  issuesReported: UserIssueDto[];
  issueCount: number;
}
