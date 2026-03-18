export interface GetBarbersForServicesResponse {
  barbers: {
    id: string;
    name: string;
    photo?: string;
    rating: { average: number; count: number };
    isAvailable: boolean;
  }[];
  bookingAmount: number;
  userCoinBalance: number;
}

export interface GetSlotsInput {
  shopId: string;
  date: string;
  serviceIds: string[];
  barberId: string;
}

export interface TimeSlot {
  time: string;
  available: boolean;
  reason?: 'booked' | 'blocked' | 'locked' | 'break' | 'passed';
}

export interface GetSlotsResponse {
  shopId: string;
  date: string;
  barberId: string;
  barberName: string;
  totalDurationMinutes: number;
  slotIntervalMinutes: number;
  workingHours: {
    start: string;
    end: string;
  };
  slots: TimeSlot[];
}

export interface BarberServiceEntry {
  serviceId: string;
  durationMinutes: number;
}

export interface BlockedRange {
  startMinutes: number;
  endMinutes: number;
}

export interface InitiateBookingInput {
  shopId: string;
  barberId: string;
  serviceIds: string[];
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  paymentMethod: 'RAZORPAY' | 'FELBO_COINS';
}

export interface BookingServiceSnapshot {
  serviceId: string;
  serviceName: string;
  price: number;
  durationMinutes: number;
}

export interface InitiateBookingResponse {
  booking: {
    id: string;
    bookingNumber: string;
    status: string;
    shop: { id: string; name: string };
    barber: { id: string; name: string };
    services: BookingServiceSnapshot[];
    date: string;
    startTime: string;
    endTime: string;
    totalServiceAmount: number;
    advancePaid: number;
    remainingAmount: number;
    paymentMethod: string;
    verificationCode: string;
    expiresAt: string;
  };
  payment?: {
    orderId: string;
    amount: number;
    currency: string;
  };
}

export interface ConfirmBookingInput {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface ConfirmBookingResponse {
  booking: {
    id: string;
    bookingNumber: string;
    status: string;
    paymentId: string;
  };
}

export interface BookingDetailsDto {
  id: string;
  userId: string;
  shopId: string;
  barberId: string;
  status: string;
}

export interface BookingListItemDto {
  id: string;
  bookingNumber: string;
  shopName: string;
  barberName: string;
  date: Date;
  startTime: string;
  endTime: string;
  totalServiceAmount: number;
  advancePaid: number;
  remainingAmount: number;
  paymentMethod: string;
  status: string;
  cancellation?: {
    cancelledAt: Date;
    cancelledBy: string;
    reason: string;
    refundCoins: number;
    refundStatus: string;
  };
  createdAt: Date;
}

export interface UserBookingsResponse {
  bookings: BookingListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminBookingListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
  associatedShopIds?: string[];
  role: string;
}

export interface AdminBookingListItemDto {
  id: string;
  bookingNumber: string;
  userPhone?: string;
  shopName: string;
  barberName: string;
  date: Date;
  startTime: string;
  endTime: string;
  totalServiceAmount: number;
  advancePaid: number;
  remainingAmount: number;
  status: string;
  createdAt: Date;
}

export interface AdminBookingListResponse {
  bookings: AdminBookingListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type CancellationReason = string;

export interface CancelBookingByUserResponse {
  booking: {
    id: string;
    bookingNumber: string;
    status: string;
    cancellation: {
      cancelledAt: string;
      cancelledBy: string;
      reason: string;
      refundCoins: number;
    };
  };
}

export interface CompleteBookingResponse {
  booking: {
    id: string;
    bookingNumber: string;
    status: string;
    completedAt: Date;
    coinsEarned: number;
  };
}

export interface CancelBookingByBarberResponse {
  booking: {
    id: string;
    bookingNumber: string;
    status: string;
    cancellation: {
      cancelledAt: string;
      cancelledBy: string;
      reason: string;
      refundAmount: number;
      refundCoins: number;
      refundType: string;
      refundStatus: string;
    };
  };
}

export interface BarberBookingListItem {
  id: string;
  bookingNumber: string;
  userName: string;
  userImage: string | null;
  date: Date;
  startTime: string;
  services: string[];
  status: string;
}

export interface BarberBookingListResponse {
  bookings: BarberBookingListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BarberBookingDetailDto {
  id: string;
  bookingNumber: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
  customer: {
    name: string;
    image: string | null;
    gender: string | null;
  };
  services: Array<{
    name: string;
    durationMinutes: number;
    price: number;
  }>;
  payment: {
    total: number;
    advancePaid: number;
    remainingToCollect: number;
  };
}

export type VendorBookingStatus =
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED_BY_USER'
  | 'CANCELLED_BY_VENDOR'
  | 'NO_SHOW'
  | 'CANCELLED';

export interface VendorBookingListParams {
  shopIds: string[];
  status?: VendorBookingStatus;
  page: number;
  limit: number;
  startDate?: Date;
  endDate?: Date;
}

export interface VendorBookingListItem {
  id: string;
  bookingNumber: string;
  userName: string;
  userImage: string | null;
  barberName: string;
  date: Date;
  startTime: string;
  endTime: string;
  services: string[];
  status: string;
}

export interface VendorBookingListResponse {
  bookings: VendorBookingListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface VendorBookingDetailDto {
  id: string;
  bookingNumber: string;
  date: Date;
  startTime: string;
  endTime: string;
  user: {
    name: string;
    profileUrl: string | null;
  };
  services: Array<{
    name: string;
    durationMinutes: number;
    price: number;
  }>;
  payment: {
    total: number;
    advancePaid: number;
    remainingAmount: number;
  };
  status: string;
}

export interface BarberDashboardStatsDto {
  todayBookings: number;
  completedBookings: number;
}

export interface BarberTodayBookingItem {
  id: string;
  bookingNumber: string;
  userImage: string | null;
  userName: string;
  services: string[];
  startTime: string;
}

export interface BarberTodayBookingsResponse {
  bookings: BarberTodayBookingItem[];
}

export type UserBookingTab = 'upcoming' | 'completed' | 'cancelled';

export interface UserBookingListItemV2 {
  id: string;
  bookingNumber: string;
  shopName: string;
  shopImage: string | null;
  barberName: string;
  services: string[];
  status: string;
  date: Date;
  startTime: string;
  otp: string | null;
  isReviewed: boolean;
}

export interface UserBookingListResponseV2 {
  bookings: UserBookingListItemV2[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UserBookingDetailDto {
  id: string;
  bookingNumber: string;
  date: Date;
  startTime: string;
  endTime: string;
  status: string;
  paymentMethod: string;
  otp: string;
  shop: {
    id: string;
    name: string;
    image: string | null;
    address: string;
    coordinates: [number, number] | null;
  };
  services: Array<{
    name: string;
    amount: number;
  }>;
  payment: {
    advancePaid: number;
    total: number;
    remainingAmount: number;
  };
  cancellation?: {
    cancelledAt: Date;
    cancelledBy: string;
    reason: string;
    refundAmount: number;
    refundCoins: number;
    refundType: string;
    refundStatus: string;
  };
}

export interface AdminBookingDetailDto {
  id: string;
  bookingNumber: string;
  userId?: string;
  userName?: string;
  userPhone?: string;
  shopId: string;
  shopName: string;
  barberId: string;
  barberName: string;
  barberSelectionType: string;
  date: Date;
  startTime: string;
  endTime: string;
  totalDurationMinutes: number;
  services: BookingServiceSnapshot[];
  totalServiceAmount: number;
  advancePaid: number;
  remainingAmount: number;
  paymentMethod: string;
  paymentId?: string;
  razorpayOrderId?: string;
  status: string;
  cancellation?: {
    cancelledAt: Date;
    cancelledBy: string;
    reason: string;
    refundAmount: number;
    refundCoins: number;
    refundType: string;
    refundStatus: string;
  };
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
