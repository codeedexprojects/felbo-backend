import mongoose, { ClientSession, PipelineStage } from 'mongoose';
import {
  ShopModel,
  IShop,
  IEmbeddedCategory,
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

  findAllByVendorId(vendorId: string): Promise<IShop[]> {
    return ShopModel.find({ vendorId, status: { $ne: 'DELETED' } }).exec();
  }

  updateById(
    id: string,
    data: Partial<
      Pick<IShop, 'name' | 'description' | 'shopType' | 'address' | 'location' | 'photos'>
    >,
    session?: ClientSession,
  ): Promise<IShop | null> {
    return ShopModel.findByIdAndUpdate(
      id,
      { $set: data },
      { returnDocument: 'after', session },
    ).exec();
  }

  updateWorkingHours(
    id: string,
    workingHours: WorkingHours,
    session?: ClientSession,
  ): Promise<IShop | null> {
    return ShopModel.findByIdAndUpdate(
      id,
      { $set: { workingHours } },
      { returnDocument: 'after', session },
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
      { returnDocument: 'after' },
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
      { returnDocument: 'after', session },
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
    query: string | undefined,
    filter: {
      city?: string;
      shopType?: string;
      minRating?: number;
      serviceName?: string;
      availableNow?: boolean;
      latitude?: number;
      longitude?: number;
      maxDistanceMeters?: number;
    },
    skip: number,
    limit: number,
  ): Promise<{ shops: Array<IShop & { distance?: number }>; total: number }> {
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
    if (filter.minRating !== undefined) {
      matchFilter['rating.average'] = { $gte: filter.minRating };
    }

    if (filter.availableNow) {
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const istNow = new Date(Date.now() + IST_OFFSET_MS);
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const day = days[istNow.getUTCDay()];
      const currentTime = `${String(istNow.getUTCHours()).padStart(2, '0')}:${String(istNow.getUTCMinutes()).padStart(2, '0')}`;
      matchFilter[`workingHours.${day}.isOpen`] = true;
      matchFilter[`workingHours.${day}.open`] = { $lte: currentTime };
      matchFilter[`workingHours.${day}.close`] = { $gte: currentTime };
    }

    if (filter.serviceName) {
      const escapedName = filter.serviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const shopIds = await ServiceModel.distinct('shopId', {
        name: { $regex: escapedName, $options: 'i' },
        isActive: true,
      }).exec();
      matchFilter._id = { $in: shopIds };
    }

    if (query) {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      matchFilter.$or = [
        { name: { $regex: escapedQuery, $options: 'i' } },
        { 'address.area': { $regex: escapedQuery, $options: 'i' } },
      ];
    }

    if (filter.latitude !== undefined && filter.longitude !== undefined) {
      const maxDistance = filter.maxDistanceMeters ?? 10_000;

      const pipeline: PipelineStage[] = [
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [filter.longitude, filter.latitude] },
            distanceField: 'distance',
            maxDistance,
            query: matchFilter,
            spherical: true,
          },
        },
        {
          $facet: {
            shops: [{ $skip: skip }, { $limit: limit }],
            total: [{ $count: 'count' }],
          },
        },
      ];

      const [result] = await ShopModel.aggregate(pipeline).exec();
      const total = (result.total as Array<{ count: number }>)[0]?.count ?? 0;
      return { shops: result.shops as Array<IShop & { distance: number }>, total };
    }

    const [shops, total] = await Promise.all([
      ShopModel.find(matchFilter).sort({ 'rating.average': -1 }).skip(skip).limit(limit).exec(),
      ShopModel.countDocuments(matchFilter).exec(),
    ]);

    return { shops, total };
  }

  // --- Category operations ---

  async createCategory(
    data: { shopId: string; name: string; displayOrder: number },
    session?: ClientSession,
  ): Promise<IEmbeddedCategory> {
    const categoryId = new mongoose.Types.ObjectId();
    const now = new Date();
    const shop = await ShopModel.findByIdAndUpdate(
      data.shopId,
      {
        $push: {
          categories: {
            _id: categoryId,
            name: data.name,
            displayOrder: data.displayOrder,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          },
        },
      },
      { returnDocument: 'after', session },
    ).exec();

    if (!shop) throw new Error('Shop not found when creating category.');
    const added = shop.categories.find((c) => c._id.equals(categoryId));
    if (!added) throw new Error('Category was not persisted.');
    return added;
  }

  async countActiveCategories(shopId: string, session?: ClientSession): Promise<number> {
    const query = ShopModel.findById(shopId);
    if (session) query.session(session);
    const shop = await query.exec();
    return shop ? shop.categories.filter((c) => c.isActive).length : 0;
  }

  async findCategoriesByShopId(shopId: string): Promise<IEmbeddedCategory[]> {
    const shop = await ShopModel.findById(shopId).exec();
    if (!shop) return [];
    return [...shop.categories]
      .filter((c) => c.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  // --- Service operations ---

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
    return ServiceModel.find({ _id: { $in: serviceIds }, shopId, isActive: true }).exec();
  }

  // Barber operations

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

  // BarberService operations
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

  findBarbersByShopId(shopId: string): Promise<IBarber[]> {
    return BarberModel.find({ shopId, isActive: true }).exec();
  }

  findServicesByShopId(shopId: string): Promise<IService[]> {
    return ServiceModel.find({ shopId, isActive: true }).exec();
  }

  findBarbersByShopIds(shopIds: string[]): Promise<IBarber[]> {
    return BarberModel.find({
      shopId: { $in: shopIds },
      isActive: true,
    })
      .lean()
      .exec();
  }

  findServicesByShopIds(shopIds: string[]): Promise<IService[]> {
    return ServiceModel.find({
      shopId: { $in: shopIds },
    })
      .lean()
      .exec();
  }
}
