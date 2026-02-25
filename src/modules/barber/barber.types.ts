export interface CreateBarberInput {
  shopId: string;
  name: string;
  phone: string;
  photo?: string;
  username: string;
  password: string;
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
  photo?: string;
  username: string;
  rating: { average: number; count: number };
  status: 'ACTIVE' | 'INACTIVE';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListBarbersFilter {
  page: number;
  limit: number;
  search?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface ListBarbersResponse {
  barbers: BarberManagementDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Onboarding: add barber during shop setup

export interface OnboardBarberServiceInput {
  serviceId: string;
  price: number;
  durationMinutes: number;
}

export interface OnboardBarberInput {
  name: string;
  phone: string;
  photo?: string;
  services: OnboardBarberServiceInput[];
}

export interface OnboardBarberServiceDto {
  id: string;
  serviceId: string;
  price: number;
  durationMinutes: number;
  isActive: boolean;
}

export interface OnboardBarberDto {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  photo?: string;
  rating: { average: number; count: number };
  status: 'ACTIVE' | 'INACTIVE';
  isActive: boolean;
  services: OnboardBarberServiceDto[];
}

export interface BarberServiceLinkDto {
  id: string;
  barberId: string;
  serviceId: string;
  shopId: string;
  price: number;
  durationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
