import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

const notificationRepository = new NotificationRepository();
export const notificationService = new NotificationService(notificationRepository);
const notificationController = new NotificationController(notificationService);

export { notificationController };
