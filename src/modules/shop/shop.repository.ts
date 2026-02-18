import { ClientSession, PipelineStage } from 'mongoose';
import { ShopModel, IShop } from './shop.model';
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
}
