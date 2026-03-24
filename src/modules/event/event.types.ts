export interface CreateEventInput {
  title: string;
  description: string;
  image: string;
  date?: Date;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  image?: string;
  date?: Date;
  isActive?: boolean;
}

export interface EventDto {
  id: string;
  title: string;
  description: string;
  image: string;
  date?: Date;
  createdBy: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListEventsFilter {
  page: number;
  limit: number;
}

export interface ListEventsResponse {
  events: EventDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
