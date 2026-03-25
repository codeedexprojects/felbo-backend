import { OnboardingStatus } from '../shop/shop.types';

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
  cancellationCount: number;
  cancellationsThisWeek: number;
  serviceCount: number;
  services?: { id: string; name: string }[];
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
  serviceCount: number;
}

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

export interface AddSelfAsBarberInput {
  name: string;
  email: string;
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
  isVendorBarber: boolean;
  onboardingStatus?: OnboardingStatus;
}

export interface AssignServiceItemInput {
  serviceId: string;
  durationMinutes: number;
}

export interface AssignServicesInput {
  services: AssignServiceItemInput[];
}

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
  refreshToken: string;
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
  fcmToken?: string;
}

export interface BarberRefreshTokenResponse {
  token: string;
  refreshToken: string;
}

export interface CreateSlotBlockInput {
  barberId: string;
  serviceIds?: string[];
  reason?: string;
}

export interface SlotBlockResult {
  id: string;
  barberId: string;
  shopId: string;
  startTime: string;
  endTime: string;

  durationMinutes: number;
  status: 'ACTIVE' | 'RELEASED';
}

export interface ReleaseSlotBlockInput {
  blockId: string;
  barberId: string;
}

export interface ListSlotBlocksQuery {
  date?: string;
  status?: 'ACTIVE' | 'RELEASED';
}

// Minimal slot block range exposed to other modules (e.g. booking)
export interface SlotBlockRange {
  startTime: string;
  endTime: string;
}

export interface BarberProfileDto {
  id: string;
  name: string;
  photo: string | null;
  phone: string;
  email: string | null;
  shopName: string;
  isVendorBarber: boolean;
  services: Array<{
    id: string;
    name: string;
    durationMinutes: number;
  }>;
}

export interface BookedSlotSummary {
  bookingNumber: string;
  customerName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  services: Array<{ name: string; durationMinutes: number }>;
}

export interface BarberDayScheduleResult {
  date: string;
  isWorking: boolean;
  workingHours: { start: string; end: string } | null;
  breaks: Array<{ start: string; end: string }>;
  blocks: SlotBlockResult[];
  bookings: BookedSlotSummary[];
  availableRanges: Array<{ startTime: string; endTime: string }>;
}

// Public-facing barber DTO used in booking flow (select barber screen)
export interface PublicBarberDto {
  id: string;
  name: string;
  photo?: string;
  rating: { average: number; count: number };
  isAvailable: boolean;
}
