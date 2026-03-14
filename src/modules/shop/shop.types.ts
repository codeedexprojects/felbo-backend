export type OnboardingStatus =
  | 'PENDING_PROFILE'
  | 'PENDING_SERVICES'
  | 'PENDING_BARBERS'
  | 'PENDING_BARBER_SERVICES'
  | 'COMPLETED';

export interface ShopServicesInput {
  shopId: string;
  type?: 'MENS' | 'WOMENS' | 'ALL';
}

export interface ShopServiceItemDto {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  isAvailable: boolean;
}

export interface ShopServicesCategoryDto {
  categoryName: string;
  services: ShopServiceItemDto[];
}

export interface ShopServicesResponse {
  categories: ShopServicesCategoryDto[];
}

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
  coordinates: [number, number];
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
  isPrimary?: boolean;
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
  shopType?: 'MENS' | 'WOMENS' | 'UNISEX';
  categoryId?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

export interface RecommendedShopsInput {
  longitude: number;
  latitude: number;
  userId: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}

export interface SearchShopsInput {
  query?: string;
  shopType?: 'MENS' | 'WOMENS' | 'UNISEX';
  categoryIds?: string[];
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
  shopType: 'MENS' | 'WOMENS' | 'UNISEX';
  address: ShopAddress;
  services: Array<{ id: string; name: string; basePrice: number }>;
  distance?: number;
  isAvailable: boolean;
  rating: { average: number; count: number };
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
  isPrimary: boolean;
  status: 'PENDING_APPROVAL' | 'ACTIVE' | 'DELETED';
  onboardingStatus: OnboardingStatus;
}

export interface VendorShopDto extends ShopDto {
  myBarberProfile: MyBarberProfile | null;
}

export interface VendorShopListDto {
  id: string;
  name: string;
  address: string;
  serviceCount: number;
  barberCount: number;
}

export interface NearbyShopDto extends ShopDto {
  distance: number; // meters
}

export interface NearbyShopCardDto {
  id: string;
  image: string | null;
  name: string;
  shopType: 'MENS' | 'WOMENS' | 'UNISEX';
  address: ShopAddress;
  isAvailable: boolean;
  closingTime: string | null;
  distance: number;
  topServices: string[];
  isFavorite: boolean;
  rating: { average: number; count: number };
}

export interface NearbyShopsResponse {
  shops: NearbyShopCardDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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

export interface PublicBarberDto {
  id: string;
  name: string;
  photo?: string;
  rating: {
    average: number;
    count: number;
  };
  isAvailableToday: boolean;
}

export interface ShopDetailsDto {
  id: string;
  name: string;
  description: string;
  shopType: 'MENS' | 'WOMENS' | 'UNISEX';
  address: ShopAddress;
  location: ShopLocation;
  rating: {
    average: number;
    count: number;
  };
  workingHours?: WorkingHours;
  photos: string[];
  barbers: PublicBarberDto[];
  isAvailable: boolean;
  isFavorite: boolean;
}

export interface AdminShopSearchInput {
  query?: string;
  page?: number;
  limit?: number;
}

export interface AdminShopSearchResultDto {
  shopId: string;
  shopName: string;
  vendorName: string;
}

export interface AdminShopSearchResponse {
  shops: AdminShopSearchResultDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AddAdditionalShopInput {
  name: string;
  shopType: 'MENS' | 'WOMENS' | 'UNISEX';
  phone: string;
  address: ShopAddress;
  location: ShopLocation; // already typed as { type: 'Point'; coordinates: [number, number] }
  description: string;
  workingHours: WorkingHours; // already typed with all 7 days
  photos: string[];
}

export interface CreateCompletedShopInput {
  vendorId: string;
  name: string;
  shopType: 'MENS' | 'WOMENS' | 'UNISEX';
  phone: string;
  address: ShopAddress;
  location: ShopLocation;
  description: string;
  workingHours: WorkingHours;
  photos: string[];
}

export interface PendingApprovalShopDto {
  id: string;
  name: string;
  shopType: 'MENS' | 'WOMENS' | 'UNISEX';
  address: ShopAddress;
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  createdAt: Date;
}

export interface PendingApprovalShopsResponse {
  shops: PendingApprovalShopDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
