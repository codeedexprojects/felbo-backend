export interface GetBarbersForServicesResponse {
  barbers: {
    id: string;
    name: string;
    photo?: string;
    rating: { average: number; count: number };
    isAvailable: boolean;
  }[];
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
  paymentMethod: 'RAZORPAY' | 'WALLET';
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
  status: string;
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

export type CancellationReason =
  | 'BARBER_SICK'
  | 'EMERGENCY'
  | 'SHOP_CLOSING'
  | 'EQUIPMENT_ISSUE'
  | 'OTHER';

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
      refundStatus: string;
    };
  };
}

export interface BarberBookingListItem {
  id: string;
  bookingNumber: string;
  userName: string;
  date: Date;
  startTime: string;
  endTime: string;
  services: BookingServiceSnapshot[];
  totalServiceAmount: number;
  status: string;
}

export interface BarberBookingListResponse {
  bookings: BarberBookingListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
    refundType: string;
    refundStatus: string;
  };
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
