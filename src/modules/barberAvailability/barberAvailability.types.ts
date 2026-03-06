export interface BreakPeriod {
  start: string;
  end: string;
  reason?: string;
}

export interface CreatePresetInput {
  name: string;
  workingHours: { start: string; end: string };
  breaks?: BreakPeriod[];
}

export interface AvailabilityPresetDto {
  id: string;
  barberId: string;
  name: string;
  workingHours: { start: string; end: string };
  breaks: BreakPeriod[];
}

export interface SetAvailabilityInput {
  isWorking: boolean;
  workingHours?: { start: string; end: string };
  breaks?: BreakPeriod[];
}

export interface AvailabilityDto {
  id: string;
  barberId: string;
  shopId: string;
  date: string; // YYYY-MM-DD
  isWorking: boolean;
  workingHours?: { start: string; end: string };
  breaks: BreakPeriod[];
}
