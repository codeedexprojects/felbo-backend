export type OnboardingStatus =
  | 'PENDING_PROFILE'
  | 'PENDING_SERVICES'
  | 'PENDING_BARBERS'
  | 'COMPLETED';

export interface ShopAddress {
  line1: string;
  line2?: string;
  area: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

export interface ShopLocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface DayHours {
  open: string;
  close: string;
  isOpen: boolean;
}

export interface WorkingHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export interface CreateShopInput {
  vendorId: string;
  name: string;
  shopType: 'MENS' | 'WOMENS' | 'UNISEX';
  phone: string;
  address: ShopAddress;
  location: ShopLocation;
}

export interface UpdateShopInput {
  name?: string;
  description?: string;
  shopType?: 'MENS' | 'WOMENS' | 'UNISEX';
  address?: ShopAddress;
  location?: {
    longitude: number;
    latitude: number;
  };
  photos?: string[];
}

export interface UpdateWorkingHoursInput {
  workingHours: WorkingHours;
}

export interface CompleteProfileInput {
  description: string;
  workingHours: WorkingHours;
  photos: string[];
}

export interface AddServiceInput {
  name: string;
  basePrice: number;
  baseDuration: number;
  description?: string;
}

export interface BarberServiceInput {
  serviceId: string;
  duration: number;
}

export interface AddBarberInput {
  name: string;
  phone: string;
  photo?: string;
  services: BarberServiceInput[];
}

export interface NearbyShopsInput {
  longitude: number;
  latitude: number;
  maxDistanceMeters?: number;
  shopType?: 'MENS' | 'WOMENS' | 'UNISEX';
  page?: number;
  limit?: number;
}

export interface SearchShopsInput {
  query: string;
  city?: string;
  shopType?: 'MENS' | 'WOMENS' | 'UNISEX';
  page?: number;
  limit?: number;
}

export interface ShopDto {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  shopType: 'MENS' | 'WOMENS' | 'UNISEX';
  phone: string;
  address: ShopAddress;
  location: ShopLocation;
  workingHours?: WorkingHours;
  photos: string[];
  rating: {
    average: number;
    count: number;
  };
  isActive: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'DELETED';
  onboardingStatus: OnboardingStatus;
}

export interface NearbyShopDto extends ShopDto {
  distance: number; // meters
}

export interface ServiceDto {
  id: string;
  shopId: string;
  name: string;
  basePrice: number;
  baseDuration: number;
  description?: string;
  isActive: boolean;
}

export interface BarberServiceDto {
  id: string;
  serviceId: string;
  duration: number;
  isActive: boolean;
}

export interface BarberDto {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  photo?: string;
  isActive: boolean;
  services: BarberServiceDto[];
}
