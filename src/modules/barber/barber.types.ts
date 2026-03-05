export interface CreateBarberInput {
  shopId: string;
  name: string;
  phone: string;
  email: string;
  photo?: string;
}

export interface UpdateBarberInput {
  name?: string;
  phone?: string;
  photo?: string;
}

export interface UpdateBarberCredentialsInput {
  username?: string;
  password?: string;
}

export interface BarberManagementDto {
  id: string;
  shopId: string;
  vendorId: string;
  name: string;
  phone: string;
  email?: string;
  photo?: string;
  username: string;
  rating: { average: number; count: number };
  status: 'INACTIVE' | 'ACTIVE' | 'DELETED';
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListBarbersFilter {
  page: number;
  limit: number;
  search?: string;
  isAvailable?: boolean;
  status?: 'INACTIVE' | 'ACTIVE' | 'DELETED';
}

export interface ListBarbersResponse {
  barbers: BarberManagementDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Onboarding: add barber during shop setup

export interface OnboardBarberInput {
  name: string;
  phone: string;
  email: string;
  photo?: string;
}

export interface OnboardBarberDto {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  email?: string;
  photo?: string;
  rating: { average: number; count: number };
  status: 'INACTIVE' | 'ACTIVE' | 'DELETED';
  isAvailable: boolean;
}

// Onboarding: assign services to a barber

export interface AddBarberServiceItemInput {
  serviceId: string;
  durationMinutes: number;
}

export interface AddBarberServicesInput {
  services: AddBarberServiceItemInput[];
}

export interface AddBarberServiceItemDto {
  id: string;
  serviceId: string;
  serviceName: string;
  durationMinutes: number;
  isActive: boolean;
}

export interface AddBarberServicesDto {
  barberId: string;
  services: AddBarberServiceItemDto[];
}

export interface BarberServiceLinkDto {
  id: string;
  barberId: string;
  serviceId: string;
  shopId: string;
  durationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Vendor-barber dual role: vendor adds themselves as barber in their own shop

export interface AddSelfAsBarberInput {
  name: string;
  phone: string;
  photo?: string;
}

export interface SelfBarberDto {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  photo?: string;
  isAvailable: boolean;
}

export interface AssignServiceItemInput {
  serviceId: string;
  durationMinutes: number;
}

export interface AssignServicesInput {
  services: AssignServiceItemInput[];
}

export interface BarberAssignedServiceDto {
  id: string;
  barberId: string;
  serviceId: string;
  shopId: string;
  serviceName: string;
  durationMinutes: number;
  isActive: boolean;
}

// Auth types

export interface BarberSendOtpInput {
  email: string;
  clientIp: string;
}

export interface BarberSendOtpResult {
  message: string;
}

export interface BarberVerifyOtpInput {
  email: string;
  otp: string;
}

export interface BarberVerifyOtpResult {
  resetToken: string;
  message: string;
}

export interface BarberSetPasswordInput {
  resetToken: string;
  newPassword: string;
}

export interface BarberAuthResult {
  token: string;
  barber: {
    id: string;
    name: string;
    email: string;
    shopId: string;
    status: 'INACTIVE' | 'ACTIVE' | 'DELETED';
  };
}

export interface BarberLoginInput {
  email: string;
  password: string;
}
