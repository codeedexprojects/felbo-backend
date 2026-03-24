import { Request, Response } from 'express';
import { EventService } from './event.service';
import {
  createEventSchema,
  updateEventSchema,
  eventIdParamSchema,
  listEventsSchema,
} from './event.validators';

export class EventController {
  constructor(private readonly eventService: EventService) {}

  createEvent = async (req: Request, res: Response): Promise<void> => {
    const validated = createEventSchema.parse(req.body);
    const adminId = req.user!.sub;
    const event = await this.eventService.createEvent(validated, adminId);
    res.status(201).json({ success: true, data: event });
  };

  listEvents = async (req: Request, res: Response): Promise<void> => {
    const validated = listEventsSchema.parse(req.query);
    const result = await this.eventService.listEvents(validated);
    res.status(200).json({ success: true, data: result });
  };

  listPublicEvents = async (req: Request, res: Response): Promise<void> => {
    const validated = listEventsSchema.parse(req.query);
    const result = await this.eventService.listPublicEvents(validated);
    res.status(200).json({ success: true, data: result });
  };

  getEvent = async (req: Request, res: Response): Promise<void> => {
    const { id } = eventIdParamSchema.parse(req.params);
    const event = await this.eventService.getEventById(id);
    res.status(200).json({ success: true, data: event });
  };

  updateEvent = async (req: Request, res: Response): Promise<void> => {
    const { id } = eventIdParamSchema.parse(req.params);
    const validated = updateEventSchema.parse(req.body);
    const event = await this.eventService.updateEvent(id, validated);
    res.status(200).json({ success: true, data: event });
  };

  deleteEvent = async (req: Request, res: Response): Promise<void> => {
    const { id } = eventIdParamSchema.parse(req.params);
    await this.eventService.deleteEvent(id);
    res.status(200).json({ success: true, message: 'Event deleted successfully.' });
  };
}
