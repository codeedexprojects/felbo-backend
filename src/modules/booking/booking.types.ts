// Input for slot generation
export interface GetSlotsInput {
  shopId: string;
  date: string; // YYYY-MM-DD (today only)
  serviceIds: string[]; // at least one
  barberId: string;
}

// A single generated time slot
export interface TimeSlot {
  time: string; // "HH:mm"
  available: boolean;
  reason?: 'booked' | 'blocked' | 'locked' | 'break' | 'passed';
}

// Response for slot generation
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

// Internal: a barber service entry used during slot calculation
export interface BarberServiceEntry {
  serviceId: string;
  durationMinutes: number;
}

// Internal: a blocked time range (booking, slot block, or slot lock)
export interface BlockedRange {
  startMinutes: number;
  endMinutes: number;
}

// ─── Phase 2: Booking Initiation ──────────────────────────────────────────────

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
    expiresAt: string; // ISO string — when the slot lock expires
  };
  payment?: {
    orderId: string;
    amount: number;
    currency: string;
  };
}
