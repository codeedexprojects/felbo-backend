import { EventModel, IEvent } from './event.model';
import { ListEventsFilter } from './event.types';

export class EventRepository {
  async create(data: {
    title: string;
    description: string;
    image: string;
    date?: Date;
    createdBy: string;
  }): Promise<IEvent> {
    return EventModel.create(data);
  }

  async findAll(filter: ListEventsFilter): Promise<{ events: IEvent[]; total: number }> {
    const skip = (filter.page - 1) * filter.limit;

    const [events, total] = await Promise.all([
      EventModel.find({ isActive: true })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filter.limit)
        .exec(),
      EventModel.countDocuments({ isActive: true }).exec(),
    ]);

    return { events, total };
  }

  findById(id: string): Promise<IEvent | null> {
    return EventModel.findById(id).exec();
  }

  updateById(
    id: string,
    data: Partial<Pick<IEvent, 'title' | 'description' | 'image' | 'date' | 'isActive'>>,
  ): Promise<IEvent | null> {
    return EventModel.findByIdAndUpdate(id, data, { returnDocument: 'after' }).exec();
  }

  async deleteById(id: string): Promise<void> {
    await EventModel.findByIdAndDelete(id).exec();
  }
}
