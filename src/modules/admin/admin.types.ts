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
  slNo: number;
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  felboCoinBalance: number;
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

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardRecentIssueDto {
  id: string;
  userName: string;
  userProfileUrl: string | null;
  reason: string;
  status: 'OPEN' | 'RESOLVED' | 'REJECTED';
  createdAt: Date;
}

export interface SuperAdminDashboardDto {
  totalUsers: number;
  totalVendors: number;
  totalBookings: number;
  todaysBookings: number;
  todaysRevenue: number;
  pendingVerifications: number;
  recentIssues: DashboardRecentIssueDto[];
}

export interface AssociationAdminDashboardDto {
  myVendorsCount: number;
  myVendorsBookings: {
    today: number;
    total: number;
  };
  myVendorsRevenue: number;
}

export interface UserDetailDto {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: 'ACTIVE' | 'BLOCKED' | 'DELETED';
  blockReason: string | null;
  felboCoinBalance: number;
  cancellationCount: number;
  registeredAt: Date;
  lastLoginAt: Date | null;
  issuesReported: UserIssueDto[];
  issueCount: number;
}
