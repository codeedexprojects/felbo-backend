import { EventRepository } from './event.repository';
import {
  CreateEventInput,
  UpdateEventInput,
  EventDto,
  ListEventsFilter,
  ListEventsResponse,
} from './event.types';
import { IEvent } from './event.model';
import { NotFoundError } from '../../shared/errors';

export class EventService {
  constructor(private readonly eventRepository: EventRepository) {}

  async createEvent(input: CreateEventInput, adminId: string): Promise<EventDto> {
    const event = await this.eventRepository.create({ ...input, createdBy: adminId });
    return this.toDto(event);
  }

  async listEvents(filter: ListEventsFilter): Promise<ListEventsResponse> {
    const { events, total } = await this.eventRepository.findAll(filter);
    return {
      events: events.map((e) => this.toDto(e)),
      total,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.ceil(total / filter.limit),
    };
  }

  async listPublicEvents(filter: ListEventsFilter): Promise<ListEventsResponse> {
    return this.listEvents(filter);
  }

  async getEventById(id: string): Promise<EventDto> {
    const event = await this.eventRepository.findById(id);
    if (!event || !event.isActive) throw new NotFoundError('Event not found.');
    return this.toDto(event);
  }

  async updateEvent(id: string, input: UpdateEventInput): Promise<EventDto> {
    const event = await this.eventRepository.findById(id);
    if (!event || !event.isActive) throw new NotFoundError('Event not found.');

    const updated = await this.eventRepository.updateById(id, input);
    if (!updated) throw new NotFoundError('Event not found.');
    return this.toDto(updated);
  }

  async deleteEvent(id: string): Promise<void> {
    const event = await this.eventRepository.findById(id);
    if (!event || !event.isActive) throw new NotFoundError('Event not found.');
    await this.eventRepository.deleteById(id);
  }

  private toDto(event: IEvent): EventDto {
    return {
      id: event._id.toString(),
      title: event.title,
      description: event.description,
      image: event.image,
      date: event.date,
      createdBy: event.createdBy.toString(),
      isActive: event.isActive,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}
