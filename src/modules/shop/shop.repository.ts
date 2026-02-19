import { ClientSession, PipelineStage } from 'mongoose';
import {
  ShopModel,
  IShop,
  ServiceModel,
  IService,
  BarberModel,
  IBarber,
  BarberServiceModel,
  IBarberService,
} from './shop.model';
import { CreateShopInput, WorkingHours } from './shop.types';

export interface NearbyShopResult {
  shop: IShop;
  distance: number;
}

export default class ShopRepository {
  async create(data: CreateShopInput, session?: ClientSession): Promise<IShop> {
    const [shop] = await ShopModel.create(
      [
        {
          vendorId: data.vendorId,
          name: data.name,
          shopType: data.shopType,
          phone: data.phone,
          address: data.address,
          location: data.location,
          isActive: true,
          status: 'ACTIVE',
          onboardingStatus: 'PENDING_PROFILE',
        },
      ],
      { session },
    );
    return shop;
  }

  findById(id: string): Promise<IShop | null> {
    return ShopModel.findById(id).exec();
  }

  findByVendorId(vendorId: string): Promise<IShop | null> {
    return ShopModel.findOne({ vendorId }).exec();
  }

  updateById(
    id: string,
    data: Partial<
      Pick<IShop, 'name' | 'description' | 'shopType' | 'address' | 'location' | 'photos'>
    >,
    session?: ClientSession,
  ): Promise<IShop | null> {
    return ShopModel.findByIdAndUpdate(id, { $set: data }, { new: true, session }).exec();
  }

  updateWorkingHours(
    id: string,
    workingHours: WorkingHours,
    session?: ClientSession,
  ): Promise<IShop | null> {
    return ShopModel.findByIdAndUpdate(
      id,
      { $set: { workingHours } },
      { new: true, session },
    ).exec();
  }

  completeProfile(
    id: string,
    data: { description: string; workingHours: WorkingHours; photos: string[] },
    onboardingStatus: string,
  ): Promise<IShop | null> {
    return ShopModel.findByIdAndUpdate(
      id,
      {
        $set: {
          description: data.description,
          workingHours: data.workingHours,
          photos: data.photos,
          onboardingStatus,
        },
      },
      { new: true },
    ).exec();
  }

  updateOnboardingStatus(
    id: string,
    onboardingStatus: string,
    session?: ClientSession,
  ): Promise<IShop | null> {
    return ShopModel.findByIdAndUpdate(
      id,
      { $set: { onboardingStatus } },
      { new: true, session },
    ).exec();
  }

  async findNearby(
    longitude: number,
    latitude: number,
    maxDistanceMeters: number,
    filter: { shopType?: string },
    skip: number,
    limit: number,
  ): Promise<NearbyShopResult[]> {
    const matchStage: Record<string, unknown> = {
      status: 'ACTIVE',
      isActive: true,
      onboardingStatus: 'COMPLETED',
    };
    if (filter.shopType) {
      matchStage.shopType = filter.shopType;
    }

    const pipeline: PipelineStage[] = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [longitude, latitude] },
          distanceField: 'distance',
          maxDistance: maxDistanceMeters,
          query: matchStage,
          spherical: true,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ];

    const results = await ShopModel.aggregate(pipeline).exec();

    return results.map((doc) => ({
      shop: doc as IShop,
      distance: doc.distance as number,
    }));
  }

  async searchByName(
    query: string,
    filter: { city?: string; shopType?: string },
    skip: number,
    limit: number,
  ): Promise<IShop[]> {
    const matchFilter: Record<string, unknown> = {
      status: 'ACTIVE',
      isActive: true,
      onboardingStatus: 'COMPLETED',
    };
    if (filter.city) {
      matchFilter['address.city'] = { $regex: filter.city, $options: 'i' };
    }
    if (filter.shopType) {
      matchFilter.shopType = filter.shopType;
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    matchFilter.$or = [
      { name: { $regex: escapedQuery, $options: 'i' } },
      { 'address.area': { $regex: escapedQuery, $options: 'i' } },
    ];

    return ShopModel.find(matchFilter).skip(skip).limit(limit).exec();
  }

  // --- Service operations ---

  async createService(
    data: {
      shopId: string;
      name: string;
      basePrice: number;
      baseDuration: number;
      description?: string;
    },
    session?: ClientSession,
  ): Promise<IService> {
    const [service] = await ServiceModel.create(
      [
        {
          shopId: data.shopId,
          name: data.name,
          basePrice: data.basePrice,
          baseDuration: data.baseDuration,
          description: data.description,
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
    return ServiceModel.find({ _id: { $in: serviceIds }, shopId, isActive: true }).exec();
  }

  // --- Barber operations ---

  async createBarber(
    data: { shopId: string; name: string; phone: string; photo?: string },
    session?: ClientSession,
  ): Promise<IBarber> {
    const [barber] = await BarberModel.create(
      [
        {
          shopId: data.shopId,
          name: data.name,
          phone: data.phone,
          photo: data.photo,
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

  // --- BarberService operations ---

  createBarberServices(
    data: Array<{
      barberId: string;
      serviceId: string;
      shopId: string;
      price: number;
      duration: number;
    }>,
    session?: ClientSession,
  ): Promise<IBarberService[]> {
    return BarberServiceModel.create(
      data.map((d) => ({
        barberId: d.barberId,
        serviceId: d.serviceId,
        shopId: d.shopId,
        price: d.price,
        duration: d.duration,
        isActive: true,
      })),
      { session },
    );
  }

  findBarberServicesByBarberId(barberId: string): Promise<IBarberService[]> {
    return BarberServiceModel.find({ barberId, isActive: true }).exec();
  }
}
