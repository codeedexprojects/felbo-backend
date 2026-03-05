export type OnboardingStatus =
  | 'PENDING_PROFILE'
  | 'PENDING_SERVICES'
  | 'PENDING_BARBERS'
  | 'PENDING_BARBER_SERVICES'
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
  photos?: string[];
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

export interface UpdateShopStatusInput {
  status: 'ACTIVE' | 'DELETED';
}

export interface ToggleShopAvailableInput {
  isAvailable: boolean;
}

export interface CompleteProfileInput {
  description: string;
  workingHours: WorkingHours;
  photos: string[];
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

export interface BarberServiceInput {
  serviceId: string;
  durationMinutes: number;
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
  query?: string;
  city?: string;
  shopType?: 'MENS' | 'WOMENS' | 'UNISEX';
  minRating?: number;
  serviceName?: string;
  availableNow?: boolean;
  latitude?: number;
  longitude?: number;
  maxDistanceMeters?: number;
  page?: number;
  limit?: number;
}

export interface ShopSearchResultDto {
  id: string;
  name: string;
  photos: string[];
  address: ShopAddress;
  services: Array<{ id: string; name: string; basePrice: number }>;
  distance?: number;
}

export interface SearchShopsResponse {
  shops: ShopSearchResultDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MyBarberProfile {
  id: string;
  name: string;
  isAvailable: boolean;
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
  isAvailable: boolean;
  status: 'ACTIVE' | 'DELETED';
  onboardingStatus: OnboardingStatus;
}

export interface VendorShopDto extends ShopDto {
  myBarberProfile: MyBarberProfile | null;
}

export interface NearbyShopDto extends ShopDto {
  distance: number; // meters
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

export interface BarberServiceDto {
  id: string;
  serviceId: string;
  durationMinutes: number;
  isActive: boolean;
}

export interface BarberDto {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  photo?: string;
  rating: {
    average: number;
    count: number;
  };
  status: 'INACTIVE' | 'ACTIVE' | 'DELETED';
  isAvailable: boolean;
  services: BarberServiceDto[];
}

export interface AdminBarberSummaryDto {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  photo?: string;
  isAvailable: boolean;
}

export interface AdminServiceSummaryDto {
  id: string;
  shopId: string;
  name: string;
  basePrice: number;
  baseDurationMinutes: number;
  description?: string;
}

// Public shop details DTOs (used by the user-facing shop details page)

export interface PublicServiceDto {
  id: string;
  categoryId: string;
  name: string;
  basePrice: number;
  minDuration: number; // minutes — min across barbers, falls back to baseDurationMinutes
  maxDuration: number; // minutes — max across barbers, falls back to baseDurationMinutes
  applicableFor: 'MENS' | 'WOMENS' | 'ALL';
  description?: string;
}

export interface PublicBarberDto {
  id: string;
  name: string;
  photo?: string;
  rating: {
    average: number;
    count: number;
  };
  isAvailableToday: boolean; // based on isActive; daily scheduling not yet modelled
}

export interface ShopDetailsDto {
  id: string;
  name: string;
  description: string;
  shopType: 'MENS' | 'WOMENS' | 'UNISEX';
  address: ShopAddress;
  distance?: number; // metres from caller, present only when lat/lng query params are sent
  rating: {
    average: number;
    count: number;
  };
  workingHours?: WorkingHours;
  photos: string[];
  services: PublicServiceDto[];
  barbers: PublicBarberDto[];
}

export interface GetShopDetailsOptions {
  latitude?: number;
  longitude?: number;
}
