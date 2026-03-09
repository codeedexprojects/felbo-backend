import { PipelineStage } from 'mongoose';
import { ClientSession } from '../../shared/database/transaction';
import { ShopModel, IShop } from './shop.model';
import { ServiceModel } from '../service/service.model';
import { CreateShopInput, WorkingHours } from './shop.types';

export interface NearbyShopResult {
  shop: IShop;
  distance: number;
}

export interface NearbyShopPage {
  results: NearbyShopResult[];
  total: number;
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
          photos: data.photos ?? [],
          isAvailable: true,
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

  updateStatus(
    id: string,
    status: 'ACTIVE' | 'DELETED',
    session?: ClientSession,
  ): Promise<IShop | null> {
    return ShopModel.findByIdAndUpdate(
      id,
      { $set: { status } },
      { returnDocument: 'after', session },
    ).exec();
  }

  updateIsAvailable(
    id: string,
    isAvailable: boolean,
    session?: ClientSession,
  ): Promise<IShop | null> {
    return ShopModel.findByIdAndUpdate(
      id,
      { $set: { isAvailable } },
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
  ): Promise<NearbyShopPage> {
    const matchStage: Record<string, unknown> = {
      status: 'ACTIVE',
      isAvailable: { $ne: false },
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
      {
        $facet: {
          shops: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await ShopModel.aggregate(pipeline).exec();
    const total = (result.total as Array<{ count: number }>)[0]?.count ?? 0;
    const results = result.shops as Array<IShop & { distance: number }>;

    return {
      results: results.map((doc) => ({ shop: doc, distance: doc.distance })),
      total,
    };
  }

  async findRecommended(
    longitude: number,
    latitude: number,
    maxDistance: number,
    shopTypes: string[] | null,
    skip: number,
    limit: number,
  ): Promise<NearbyShopPage> {
    const matchStage: Record<string, unknown> = {
      status: 'ACTIVE',
      isAvailable: { $ne: false },
      onboardingStatus: 'COMPLETED',
    };
    if (shopTypes && shopTypes.length > 0) {
      matchStage.shopType = { $in: shopTypes };
    }

    const pipeline: PipelineStage[] = [
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [longitude, latitude] },
          distanceField: 'distance',
          maxDistance,
          query: matchStage,
          spherical: true,
        },
      },
      { $sort: { 'rating.average': -1 } },
      {
        $facet: {
          shops: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await ShopModel.aggregate(pipeline).exec();
    const total = (result.total as Array<{ count: number }>)[0]?.count ?? 0;
    const results = result.shops as Array<IShop & { distance: number }>;

    return {
      results: results.map((doc) => ({ shop: doc, distance: doc.distance })),
      total,
    };
  }

  async searchByName(
    query: string | undefined,
    filter: {
      shopType?: string;
      categoryId?: string;
      latitude?: number;
      longitude?: number;
      maxDistanceMeters?: number;
    },
    skip: number,
    limit: number,
  ): Promise<{ shops: Array<IShop & { distance?: number }>; total: number }> {
    const matchFilter: Record<string, unknown> = {
      status: 'ACTIVE',
      isAvailable: { $ne: false },
      onboardingStatus: 'COMPLETED',
    };

    if (filter.shopType) {
      matchFilter.shopType = filter.shopType;
    }
    let categoryShopIds: string[] | null = null;

    if (filter.categoryId) {
      const ids = await ServiceModel.distinct('shopId', {
        categoryId: filter.categoryId,
        isActive: true,
      }).exec();
      categoryShopIds = ids.map(String);
    }

    if (categoryShopIds !== null) {
      matchFilter._id = { $in: categoryShopIds };
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

  async adminSearchShops(
    query: string | undefined,
    skip: number,
    limit: number,
  ): Promise<{
    results: Array<{ shopId: string; shopName: string; vendorName: string }>;
    total: number;
  }> {
    const pipeline: PipelineStage[] = [
      { $match: { status: { $ne: 'DELETED' } } },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendor',
        },
      },
      { $unwind: '$vendor' },
    ];

    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = { $regex: escaped, $options: 'i' };
      pipeline.push({
        $match: { $or: [{ name: regex }, { 'vendor.ownerName': regex }] },
      });
    }

    pipeline.push({
      $facet: {
        results: [
          { $skip: skip },
          { $limit: limit },
          { $project: { _id: 1, name: 1, vendorName: '$vendor.ownerName' } },
        ],
        total: [{ $count: 'count' }],
      },
    });

    const [result] = await ShopModel.aggregate(pipeline).exec();
    const total = (result.total as Array<{ count: number }>)[0]?.count ?? 0;
    const docs = result.results as Array<{
      _id: { toString(): string };
      name: string;
      vendorName: string;
    }>;

    return {
      results: docs.map((d) => ({
        shopId: d._id.toString(),
        shopName: d.name,
        vendorName: d.vendorName,
      })),
      total,
    };
  }
}
