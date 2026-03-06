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
