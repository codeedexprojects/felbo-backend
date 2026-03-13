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
  price: number;
  duration: number;
  isActive: boolean;
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

export interface AddServiceInput {
  categoryId: string;
  name: string;
  basePrice: number;
  baseDurationMinutes: number;
  applicableFor: 'MENS' | 'WOMENS' | 'ALL';
  description?: string;
}

export interface UpdateServiceInput {
  name?: string;
  basePrice?: number;
  baseDurationMinutes?: number;
  applicableFor?: 'MENS' | 'WOMENS' | 'ALL';
  description?: string;
}

export interface ServiceDto {
  id: string;
  shopId: string;
  categoryId: string;
  name: string;
  basePrice: number;
  baseDurationMinutes: number;
  applicableFor: 'MENS' | 'WOMENS' | 'ALL';
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED';
  isActive: boolean;
}

export interface AdminServiceSummaryDto {
  id: string;
  shopId: string;
  name: string;
  basePrice: number;
  baseDurationMinutes: number;
  description?: string;
}

export interface PublicServiceDto {
  id: string;
  categoryId: string;
  name: string;
  basePrice: number;
  minDuration: number;
  maxDuration: number;
  applicableFor: 'MENS' | 'WOMENS' | 'ALL';
  description?: string;
}

export interface BookingServiceSnapshotData {
  id: string;
  name: string;
  categoryName: string;
  basePrice: number;
}
