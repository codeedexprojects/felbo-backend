import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { ClientSession } from '../../shared/database/transaction';
import { BarberModel, IBarber, SlotBlockModel, ISlotBlock } from './barber.model';
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

  findByIdWithRefreshToken(id: string): Promise<IBarber | null> {
    return BarberModel.findById(id).select('+refreshTokenHash').exec();
  }

  updateRefreshToken(id: string, refreshTokenHash: string | null): Promise<IBarber | null> {
    return BarberModel.findByIdAndUpdate(id, { refreshTokenHash }, { new: true }).exec();
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
      isVendorBarber?: boolean;
      status?: 'INACTIVE' | 'ACTIVE';
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
          isVendorBarber: data.isVendorBarber ?? false,
          rating: { average: 0, count: 0 },
          status: data.status ?? 'INACTIVE',
          isAvailable: true,
        },
      ],
      { session },
    );
    return barber;
  }

  findVendorBarberProfile(vendorId: string): Promise<IBarber | null> {
    return BarberModel.findOne({ vendorId, isVendorBarber: true, status: 'ACTIVE' }).exec();
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

  findBarberServicesByBarberIds(barberIds: string[]): Promise<IBarberService[]> {
    return BarberServiceModel.find({ barberId: { $in: barberIds }, isActive: true })
      .lean<IBarberService[]>()
      .exec();
  }

  findBarberServicesByShopId(shopId: string): Promise<IBarberService[]> {
    return BarberServiceModel.find({ shopId, isActive: true }).lean<IBarberService[]>().exec();
  }

  findBarberServicesByShopIds(shopIds: string[]): Promise<IBarberService[]> {
    return BarberServiceModel.find({ shopId: { $in: shopIds }, isActive: true })
      .lean<IBarberService[]>()
      .exec();
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

  findBarberServicesByServiceIds(
    barberId: string,
    serviceIds: string[],
  ): Promise<IBarberService[]> {
    return BarberServiceModel.find({ barberId, serviceId: { $in: serviceIds }, isActive: true })
      .lean<IBarberService[]>()
      .exec();
  }

  async removeBarberService(barberId: string, serviceId: string): Promise<void> {
    await BarberServiceModel.deleteOne({ barberId, serviceId }).exec();
  }

  async existsByServiceId(serviceId: string): Promise<boolean> {
    const doc = await BarberServiceModel.exists({ serviceId }).exec();
    return doc !== null;
  }

  async findBarberIdsWithAllServices(shopId: string, serviceIds: string[]): Promise<string[]> {
    const results = await BarberServiceModel.aggregate<{ _id: mongoose.Types.ObjectId }>([
      {
        $match: {
          shopId: new mongoose.Types.ObjectId(shopId),
          serviceId: { $in: serviceIds.map((id) => new mongoose.Types.ObjectId(id)) },
          isActive: true,
        },
      },
      {
        $group: {
          _id: '$barberId',
          matchedCount: { $sum: 1 },
        },
      },
      {
        $match: { matchedCount: serviceIds.length },
      },
    ]).exec();

    return results.map((r) => r._id.toString());
  }

  findActiveBarbersByIds(ids: string[]): Promise<IBarber[]> {
    return BarberModel.find({
      _id: { $in: ids },
      status: 'ACTIVE',
      isAvailable: true,
    })
      .lean<IBarber[]>()
      .exec();
  }

  async createSlotBlock(data: {
    shopId: string;
    barberId: string;
    serviceIds?: string[];
    createdBy: string;
    date: Date;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    reason?: string;
    status: 'ACTIVE' | 'RELEASED';
  }): Promise<ISlotBlock> {
    const [block] = await SlotBlockModel.create([
      {
        shopId: data.shopId,
        barberId: data.barberId,
        serviceIds: data.serviceIds,
        createdBy: data.createdBy,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        durationMinutes: data.durationMinutes,
        reason: data.reason,
        status: data.status,
      },
    ]);
    return block;
  }

  findSlotBlockById(id: string): Promise<ISlotBlock | null> {
    return SlotBlockModel.findById(id).lean<ISlotBlock>().exec();
  }

  async releaseSlotBlock(id: string): Promise<ISlotBlock | null> {
    return SlotBlockModel.findByIdAndUpdate(
      id,
      {
        status: 'RELEASED',
        releasedAt: new Date(),
      },
      { new: true },
    )
      .lean<ISlotBlock>()
      .exec();
  }

  findActiveBlocksByBarberAndDate(barberId: string, date: Date): Promise<ISlotBlock[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return SlotBlockModel.find({
      barberId,
      status: 'ACTIVE',
      date: { $gte: startOfDay, $lt: endOfDay },
    })
      .lean<ISlotBlock[]>()
      .exec();
  }

  findOverlappingActiveBlocks(
    barberId: string,
    date: Date,
    newStartTime: string,
    newEndTime: string,
  ): Promise<ISlotBlock[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return SlotBlockModel.find({
      barberId,
      status: 'ACTIVE',
      date: { $gte: startOfDay, $lt: endOfDay },
      startTime: { $lt: newEndTime },
      endTime: { $gt: newStartTime },
    })
      .lean<ISlotBlock[]>()
      .exec();
  }

  listSlotBlocks(
    barberId: string,
    date: Date,
    status?: 'ACTIVE' | 'RELEASED',
  ): Promise<ISlotBlock[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const query: {
      barberId: string;
      date: { $gte: Date; $lt: Date };
      status?: 'ACTIVE' | 'RELEASED';
    } = {
      barberId,
      date: { $gte: startOfDay, $lt: endOfDay },
    };

    if (status) {
      query.status = status;
    }

    return SlotBlockModel.find(query).sort({ startTime: 1 }).lean<ISlotBlock[]>().exec();
  }

  countActiveByShopIds(shopIds: string[]): Promise<number> {
    return BarberModel.countDocuments({
      shopId: { $in: shopIds.map((id) => new Types.ObjectId(id)) },
      status: 'ACTIVE',
    }).exec();
  }

  findActiveByShopIds(shopIds: string[]): Promise<Pick<IBarber, '_id' | 'name' | 'photo'>[]> {
    return BarberModel.find(
      { shopId: { $in: shopIds.map((id) => new Types.ObjectId(id)) }, status: 'ACTIVE' },
      { name: 1, photo: 1 },
    )
      .lean<Pick<IBarber, '_id' | 'name' | 'photo'>[]>()
      .exec();
  }

  async countBarbersByShopIds(shopIds: string[]): Promise<Map<string, number>> {
    const results = await BarberModel.aggregate([
      {
        $match: {
          shopId: { $in: shopIds.map((id) => new Types.ObjectId(id)) },
          status: 'ACTIVE',
        },
      },
      { $group: { _id: '$shopId', count: { $sum: 1 } } },
    ]).exec();

    const countsMap = new Map<string, number>();
    for (const r of results) {
      countsMap.set(r._id.toString(), r.count);
    }
    return countsMap;
  }

  addFcmToken(barberId: string, token: string): Promise<unknown> {
    return BarberModel.updateOne({ _id: barberId }, { $addToSet: { fcmTokens: token } }).exec();
  }

  removeFcmToken(barberId: string, token: string): Promise<unknown> {
    return BarberModel.updateOne({ _id: barberId }, { $pull: { fcmTokens: token } }).exec();
  }

  async getFcmTokens(barberId: string): Promise<string[]> {
    const doc = await BarberModel.findById(barberId)
      .select('+fcmTokens')
      .lean<{ fcmTokens?: string[] }>()
      .exec();
    return doc?.fcmTokens ?? [];
  }

  async pruneInvalidFcmTokens(tokens: string[]): Promise<void> {
    if (!tokens.length) return;
    await BarberModel.updateMany(
      { fcmTokens: { $in: tokens } },
      { $pull: { fcmTokens: { $in: tokens } } },
    ).exec();
  }
}
