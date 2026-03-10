import { ClientSession } from '../../shared/database/transaction';
import { BarberServiceModel, IBarberService, ServiceModel, IService } from './service.model';

export interface IBarberServicePopulated extends Omit<IBarberService, 'serviceId'> {
  serviceId: Pick<IService, '_id' | 'name'>;
}

export class ServiceRepository {
  createBarberService(
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
      { session },
    );
  }

  findBarberServicesByBarberId(barberId: string): Promise<IBarberService[]> {
    return BarberServiceModel.find({ barberId, isActive: true }).lean().exec();
  }

  findBarberServicesByBarberIdPopulated(barberId: string): Promise<IBarberServicePopulated[]> {
    return BarberServiceModel.find({ barberId, isActive: true })
      .populate<Pick<IBarberServicePopulated, 'serviceId'>>('serviceId', 'name')
      .lean()
      .exec() as unknown as Promise<IBarberServicePopulated[]>;
  }

  findBarberServicesByShopId(shopId: string): Promise<IBarberService[]> {
    return BarberServiceModel.find({ shopId, isActive: true }).lean().exec();
  }

  findBarberServiceByBarberAndServiceId(
    barberId: string,
    serviceId: string,
  ): Promise<IBarberService | null> {
    return BarberServiceModel.findOne({ barberId, serviceId }).exec();
  }

  async replaceBarberServicesForBarber(
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
      { session },
    );
  }

  async removeBarberServiceByBarberAndServiceId(
    barberId: string,
    serviceId: string,
  ): Promise<void> {
    await BarberServiceModel.deleteOne({ barberId, serviceId }).exec();
  }

  async existsBarberServiceByServiceId(serviceId: string): Promise<boolean> {
    const doc = await BarberServiceModel.exists({ serviceId }).exec();
    return doc !== null;
  }

  async createService(
    data: {
      shopId: string;
      categoryId: string;
      name: string;
      basePrice: number;
      baseDurationMinutes: number;
      applicableFor: 'MENS' | 'WOMENS' | 'ALL';
      description?: string;
    },
    session?: ClientSession,
  ): Promise<IService> {
    const [service] = await ServiceModel.create(
      [
        {
          shopId: data.shopId,
          categoryId: data.categoryId,
          name: data.name,
          basePrice: data.basePrice,
          baseDurationMinutes: data.baseDurationMinutes,
          applicableFor: data.applicableFor,
          description: data.description,
          status: 'ACTIVE',
          isActive: true,
        },
      ],
      { session },
    );
    return service;
  }

  countActiveServices(shopId: string, session?: ClientSession): Promise<number> {
    return ServiceModel.countDocuments({ shopId, isActive: true })
      .session(session ?? null)
      .exec();
  }

  findActiveServicesByIds(serviceIds: string[], shopId: string): Promise<IService[]> {
    return ServiceModel.find({ _id: { $in: serviceIds }, shopId, isActive: true })
      .lean()
      .exec() as unknown as Promise<IService[]>;
  }

  findServicesByShopId(shopId: string): Promise<IService[]> {
    return ServiceModel.find({ shopId, isActive: true }).lean().exec() as unknown as Promise<
      IService[]
    >;
  }

  findServicesByShopIds(shopIds: string[]): Promise<IService[]> {
    return ServiceModel.find({
      shopId: { $in: shopIds },
    })
      .lean()
      .exec();
  }

  findServiceById(id: string): Promise<IService | null> {
    return ServiceModel.findById(id).exec();
  }

  findServicesByIds(ids: string[]): Promise<IService[]> {
    return ServiceModel.find({ _id: { $in: ids }, status: { $ne: 'DELETED' } })
      .lean()
      .exec() as unknown as Promise<IService[]>;
  }

  updateService(
    id: string,
    data: Partial<
      Pick<IService, 'name' | 'basePrice' | 'baseDurationMinutes' | 'applicableFor' | 'description'>
    >,
  ): Promise<IService | null> {
    return ServiceModel.findByIdAndUpdate(id, { $set: data }, { returnDocument: 'after' }).exec();
  }

  softDeleteService(id: string): Promise<IService | null> {
    return ServiceModel.findByIdAndUpdate(
      id,
      { $set: { status: 'DELETED', isActive: false } },
      { returnDocument: 'after' },
    ).exec();
  }

  toggleServiceActive(id: string, isActive: boolean): Promise<IService | null> {
    return ServiceModel.findByIdAndUpdate(
      id,
      { $set: { isActive, status: isActive ? 'ACTIVE' : 'INACTIVE' } },
      { returnDocument: 'after' },
    ).exec();
  }

  countActiveByCategoryId(categoryId: string): Promise<number> {
    return ServiceModel.countDocuments({ categoryId, isActive: true }).exec();
  }
}
