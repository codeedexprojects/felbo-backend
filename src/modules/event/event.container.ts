import { EventRepository } from './event.repository';
import { EventService } from './event.service';
import { EventController } from './event.controller';

const eventRepository = new EventRepository();
const eventService = new EventService(eventRepository);
const eventController = new EventController(eventService);

export { eventController };
