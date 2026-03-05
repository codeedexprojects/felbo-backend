import { ClientSession } from 'mongoose';
import { BarberModel, IBarber } from './barber.model';
import { BarberServiceModel, IBarberService } from '../service/service.model';
import { ListBarbersFilter } from './barber.types';

export class BarberRepository {
  async findByShopId(
    shopId: string,
    filter: ListBarbersFilter,
  ): Promise<{ barbers: IBarber[]; total: number }> {
    const query: Record<string, unknown> = { shopId, status: { $ne: 'DELETED' } };

    if (filter.search) {
      const searchRegex = {
        $regex: filter.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
      query.$or = [{ name: searchRegex }, { phone: searchRegex }, { email: searchRegex }];
    }

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.isAvailable !== undefined) {
      query.isAvailable = filter.isAvailable;
    }

    const skip = (filter.page - 1) * filter.limit;

    const [barbers, total] = await Promise.all([
      BarberModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filter.limit)
        .lean<IBarber[]>()
        .exec(),
      BarberModel.countDocuments(query).exec(),
    ]);

    return { barbers, total };
  }

  findById(id: string): Promise<IBarber | null> {
    return BarberModel.findById(id).lean<IBarber>().exec();
  }

  findByIdWithPassword(id: string): Promise<IBarber | null> {
    return BarberModel.findById(id).select('+passwordHash').lean<IBarber>().exec();
  }

  findByUsername(username: string): Promise<IBarber | null> {
    return BarberModel.findOne({ username }).lean<IBarber>().exec();
  }

  findByPhone(shopId: string, phone: string): Promise<IBarber | null> {
    return BarberModel.findOne({ shopId, phone, status: { $ne: 'DELETED' } })
      .lean<IBarber>()
      .exec();
  }

  findByEmail(email: string): Promise<IBarber | null> {
    return BarberModel.findOne({ email, status: { $ne: 'DELETED' } })
      .lean<IBarber>()
      .exec();
  }

  findByEmailWithPassword(email: string): Promise<IBarber | null> {
    return BarberModel.findOne({ email, status: { $ne: 'DELETED' } })
      .select('+passwordHash')
      .lean<IBarber>()
      .exec();
  }

  async create(data: {
    shopId: string;
    vendorId: string;
    name: string;
    phone: string;
    email: string;
    photo?: string;
  }): Promise<IBarber> {
    return BarberModel.create({ ...data, status: 'ACTIVE' });
  }

  async createBarber(
    data: {
      shopId: string;
      vendorId: string;
      name: string;
      phone: string;
      email: string;
      photo?: string;
    },
    session?: ClientSession,
  ): Promise<IBarber> {
    const [barber] = await BarberModel.create(
      [
        {
          shopId: data.shopId,
          vendorId: data.vendorId,
          name: data.name,
          phone: data.phone,
          email: data.email,
          photo: data.photo,
          rating: { average: 0, count: 0 },
          status: 'INACTIVE',
          isAvailable: true,
        },
      ],
      { session },
    );
    return barber;
  }

  countActiveBarbers(shopId: string, session?: ClientSession): Promise<number> {
    return BarberModel.countDocuments({ shopId, status: 'ACTIVE' })
      .session(session ?? null)
      .exec();
  }

  createBarberServices(
    data: Array<{
      barberId: string;
      serviceId: string;
      shopId: string;
      durationMinutes: number;
    }>,
    session?: ClientSession,
  ): Promise<IBarberService[]> {
    return BarberServiceModel.create(
      data.map((d) => ({
        barberId: d.barberId,
        serviceId: d.serviceId,
        shopId: d.shopId,
        durationMinutes: d.durationMinutes,
        isActive: true,
      })),
      { session, ordered: true },
    );
  }

  findBarberServicesByBarberId(barberId: string): Promise<IBarberService[]> {
    return BarberServiceModel.find({ barberId, isActive: true }).lean<IBarberService[]>().exec();
  }

  findBarberServicesByShopId(shopId: string): Promise<IBarberService[]> {
    return BarberServiceModel.find({ shopId, isActive: true }).lean<IBarberService[]>().exec();
  }

  findAllActiveByShopId(shopId: string): Promise<IBarber[]> {
    return BarberModel.find({ shopId, status: 'ACTIVE' }).lean<IBarber[]>().exec();
  }

  findBarbersByShopIds(shopIds: string[]): Promise<IBarber[]> {
    return BarberModel.find({
      shopId: { $in: shopIds },
      status: 'ACTIVE',
    })
      .lean()
      .exec();
  }

  updateById(
    id: string,
    data: Partial<Pick<IBarber, 'name' | 'phone' | 'photo'>>,
  ): Promise<IBarber | null> {
    return BarberModel.findByIdAndUpdate(id, data, { returnDocument: 'after' }).exec();
  }

  updateAvailability(id: string, isAvailable: boolean): Promise<IBarber | null> {
    return BarberModel.findByIdAndUpdate(id, { isAvailable }, { new: true }).exec();
  }

  updateCredentials(
    id: string,
    update: { username?: string; passwordHash?: string },
  ): Promise<IBarber | null> {
    return BarberModel.findByIdAndUpdate(id, update, { returnDocument: 'after' }).exec();
  }

  setPassword(id: string, passwordHash: string): Promise<IBarber | null> {
    return BarberModel.findByIdAndUpdate(id, { passwordHash }, { new: true }).exec();
  }

  async activateBarbersByVendorId(vendorId: string, session?: ClientSession): Promise<void> {
    await BarberModel.updateMany(
      { vendorId, status: 'INACTIVE' },
      { $set: { status: 'ACTIVE' } },
      { session },
    ).exec();
  }

  async softDelete(id: string): Promise<void> {
    await BarberModel.findByIdAndUpdate(id, { status: 'DELETED' }).exec();
  }

  async replaceBarberServices(
    barberId: string,
    shopId: string,
    services: Array<{ serviceId: string; durationMinutes: number }>,
    session?: ClientSession,
  ): Promise<IBarberService[]> {
    await BarberServiceModel.deleteMany({ barberId })
      .session(session ?? null)
      .exec();

    if (services.length === 0) return [];

    return BarberServiceModel.create(
      services.map((s) => ({
        barberId,
        serviceId: s.serviceId,
        shopId,
        durationMinutes: s.durationMinutes,
        isActive: true,
      })),
      { session, ordered: true },
    );
  }

  findBarberServiceByIds(barberId: string, serviceId: string): Promise<IBarberService | null> {
    return BarberServiceModel.findOne({ barberId, serviceId }).lean<IBarberService>().exec();
  }

  async removeBarberService(barberId: string, serviceId: string): Promise<void> {
    await BarberServiceModel.deleteOne({ barberId, serviceId }).exec();
  }

  async existsByServiceId(serviceId: string): Promise<boolean> {
    const doc = await BarberServiceModel.exists({ serviceId }).exec();
    return doc !== null;
  }
}
