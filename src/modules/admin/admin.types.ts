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
  admin: AdminDTO;
}
