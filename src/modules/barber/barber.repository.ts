import { ClientSession } from 'mongoose';
import { BarberModel, IBarber, BarberServiceModel, IBarberService } from './barber.model';
import { ListBarbersFilter } from './barber.types';

export class BarberRepository {
  async findByShopId(
    shopId: string,
    filter: ListBarbersFilter,
  ): Promise<{ barbers: IBarber[]; total: number }> {
    const query: Record<string, unknown> = { shopId, isActive: true };

    if (filter.search) {
      const searchRegex = {
        $regex: filter.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
      query.$or = [{ name: searchRegex }, { phone: searchRegex }, { username: searchRegex }];
    }

    if (filter.status) {
      query.status = filter.status;
    }

    const skip = (filter.page - 1) * filter.limit;

    const [barbers, total] = await Promise.all([
      BarberModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).exec(),
      BarberModel.countDocuments(query).exec(),
    ]);

    return { barbers, total };
  }

  findById(id: string): Promise<IBarber | null> {
    return BarberModel.findById(id).exec();
  }

  findByIdWithPassword(id: string): Promise<IBarber | null> {
    return BarberModel.findById(id).select('+passwordHash').exec();
  }

  findByUsername(username: string): Promise<IBarber | null> {
    return BarberModel.findOne({ username }).exec();
  }

  findByPhone(shopId: string, phone: string): Promise<IBarber | null> {
    return BarberModel.findOne({ shopId, phone, isActive: true }).exec();
  }

  async create(data: {
    shopId: string;
    vendorId: string;
    name: string;
    phone: string;
    photo?: string;
    username: string;
    passwordHash: string;
  }): Promise<IBarber> {
    return BarberModel.create(data);
  }

  async createBarber(
    data: { shopId: string; vendorId: string; name: string; phone: string; photo?: string },
    session?: ClientSession,
  ): Promise<IBarber> {
    const [barber] = await BarberModel.create(
      [
        {
          shopId: data.shopId,
          vendorId: data.vendorId,
          name: data.name,
          phone: data.phone,
          photo: data.photo,
          rating: { average: 0, count: 0 },
          status: 'ACTIVE',
          isActive: true,
        },
      ],
      { session },
    );
    return barber;
  }

  countActiveBarbers(shopId: string, session?: ClientSession): Promise<number> {
    return BarberModel.countDocuments({ shopId, isActive: true })
      .session(session ?? null)
      .exec();
  }

  createBarberServices(
    data: Array<{
      barberId: string;
      serviceId: string;
      shopId: string;
      price: number;
      durationMinutes: number;
    }>,
    session?: ClientSession,
  ): Promise<IBarberService[]> {
    return BarberServiceModel.create(
      data.map((d) => ({
        barberId: d.barberId,
        serviceId: d.serviceId,
        shopId: d.shopId,
        price: d.price,
        durationMinutes: d.durationMinutes,
        isActive: true,
      })),
      { session },
    );
  }

  findBarberServicesByBarberId(barberId: string): Promise<IBarberService[]> {
    return BarberServiceModel.find({ barberId, isActive: true }).exec();
  }

  findBarberServicesByShopId(shopId: string): Promise<IBarberService[]> {
    return BarberServiceModel.find({ shopId, isActive: true }).exec();
  }

  findAllActiveByShopId(shopId: string): Promise<IBarber[]> {
    return BarberModel.find({ shopId, isActive: true }).exec();
  }

  findBarbersByShopIds(shopIds: string[]): Promise<IBarber[]> {
    return BarberModel.find({
      shopId: { $in: shopIds },
      isActive: true,
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

  updateStatus(id: string, status: 'ACTIVE' | 'INACTIVE'): Promise<IBarber | null> {
    return BarberModel.findByIdAndUpdate(id, { status }, { returnDocument: 'after' }).exec();
  }

  updateCredentials(
    id: string,
    update: { username?: string; passwordHash?: string },
  ): Promise<IBarber | null> {
    return BarberModel.findByIdAndUpdate(id, update, { returnDocument: 'after' }).exec();
  }

  async softDelete(id: string): Promise<void> {
    await BarberModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }
}
