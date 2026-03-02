import { AdminRole, AdminStatus } from './admin.model';

export interface AdminDTO {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AdminRole;
  status: AdminStatus;
  createdBy?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminLoginInput {
  email: string;
  password: string;
}

export interface AdminLoginResponse {
  token: string;
  refreshToken: string;
  admin: AdminDTO;
}

// ─── User Management ────────────────────────────────────────────────────────

export interface ListUsersFilter {
  search?: string;
  status?: 'ACTIVE' | 'BLOCKED';
  page: number;
  limit: number;
}

export interface UserListItemDto {
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
