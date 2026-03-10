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
