import mongoose, { PipelineStage, Types } from 'mongoose';
import { ClientSession } from '../../shared/database/transaction';
import { ShopModel, IShop } from './shop.model';
import { CreateCompletedShopInput, CreateShopInput, WorkingHours } from './shop.types';

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
          isPrimary: data.isPrimary ?? false,
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

  findByIds(ids: string[]): Promise<IShop[]> {
    return ShopModel.find({ _id: { $in: ids }, status: { $ne: 'DELETED' } })
      .lean()
      .exec() as unknown as Promise<IShop[]>;
  }

  findAllByVendorId(vendorId: string): Promise<IShop[]> {
    return ShopModel.find({ vendorId, status: { $ne: 'DELETED' } }).exec();
  }

  async findIdsByVendorIds(vendorIds: string[]): Promise<string[]> {
    const objectIds = vendorIds.map((id) => new mongoose.Types.ObjectId(id));
    const shops = await ShopModel.find({ vendorId: { $in: objectIds }, status: { $ne: 'DELETED' } })
      .select('_id')
      .lean<{ _id: mongoose.Types.ObjectId }[]>()
      .exec();
    return shops.map((s) => s._id.toString());
  }

  async createCompleted(data: CreateCompletedShopInput): Promise<IShop> {
    const [shop] = await ShopModel.create([
      {
        ...data,
        isAvailable: true,
        isPrimary: false,
        status: 'PENDING_APPROVAL',
        onboardingStatus: 'PENDING_SERVICES',
      },
    ]);
    return shop;
  }

  async findPendingApproval(
    page: number,
    limit: number,
  ): Promise<{
    shops: Array<IShop & { vendorName: string; vendorPhone: string }>;
    total: number;
  }> {
    const skip = (page - 1) * limit;

    const pipeline: PipelineStage[] = [
      { $match: { status: 'PENDING_APPROVAL' } },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendor',
        },
      },
      { $unwind: '$vendor' },
      {
        $facet: {
          shops: [{ $sort: { createdAt: 1 } }, { $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ];

    const [result] = await ShopModel.aggregate(pipeline).exec();
    const shops = (result?.shops ?? []) as unknown as Array<
      IShop & { vendor: { ownerName: string; phone: string } }
    >;
    const total: number = result?.total?.[0]?.count ?? 0;

    return {
      shops: shops.map((s) => ({
        ...s,
        vendorName: s.vendor.ownerName,
        vendorPhone: s.vendor.phone,
      })) as unknown as Array<IShop & { vendorName: string; vendorPhone: string }>,
      total,
    };
  }

  findPendingApprovalCount(): Promise<number> {
    return ShopModel.countDocuments({ status: 'PENDING_APPROVAL' }).exec();
  }

  async findPendingById(shopId: string): Promise<
    | (IShop & {
        vendor: { _id: mongoose.Types.ObjectId; ownerName: string; phone: string; email?: string };
      })
    | null
  > {
    const pipeline: PipelineStage[] = [
      { $match: { _id: new Types.ObjectId(shopId), status: 'PENDING_APPROVAL' } },
      {
        $lookup: {
          from: 'vendors',
          localField: 'vendorId',
          foreignField: '_id',
          as: 'vendor',
        },
      },
      { $unwind: '$vendor' },
      { $limit: 1 },
    ];

    const [result] = await ShopModel.aggregate(pipeline).exec();
    return (result ?? null) as unknown as
      | (IShop & {
          vendor: {
            _id: mongoose.Types.ObjectId;
            ownerName: string;
            phone: string;
            email?: string;
          };
        })
      | null;
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

  updateIsAvailableByVendorId(
    vendorId: string,
    isAvailable: boolean,
    session?: ClientSession,
  ): Promise<unknown> {
    return ShopModel.updateMany(
      {
        vendorId: new mongoose.Types.ObjectId(vendorId),
        status: { $in: ['ACTIVE', 'PENDING_APPROVAL'] },
      },
      { $set: { isAvailable } },
      { session },
    ).exec();
  }

  addCategoryIfMissing(shopId: string, categoryId: string): Promise<IShop | null> {
    return ShopModel.findByIdAndUpdate(
      shopId,
      { $addToSet: { categoryIds: new Types.ObjectId(categoryId) } },
      { returnDocument: 'after' },
    ).exec();
  }

  removeCategoryFromShop(shopId: string, categoryId: string): Promise<IShop | null> {
    return ShopModel.findByIdAndUpdate(
      shopId,
      { $pull: { categoryIds: new Types.ObjectId(categoryId) } },
      { returnDocument: 'after' },
    ).exec();
  }

  async findNearby(
    longitude: number,
    latitude: number,
    maxDistanceMeters: number,
    filter: { shopType?: string; categoryId?: string },
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
    if (filter.categoryId) {
      matchStage.categoryIds = new Types.ObjectId(filter.categoryId);
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
    categoryId?: string,
  ): Promise<NearbyShopPage> {
    const matchStage: Record<string, unknown> = {
      status: 'ACTIVE',
      isAvailable: { $ne: false },
      onboardingStatus: 'COMPLETED',
    };
    if (shopTypes && shopTypes.length > 0) {
      matchStage.shopType = { $in: shopTypes };
    }
    if (categoryId) {
      matchStage.categoryIds = new Types.ObjectId(categoryId);
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
      categoryIds?: string[];
      latitude?: number;
      longitude?: number;
      maxDistanceMeters?: number;
      serviceShopIds?: Set<string>;
    },
    skip: number,
    limit: number,
  ): Promise<{ shops: Array<IShop & { distance?: number }>; total: number }> {
    const baseFilter: Record<string, unknown> = {
      status: 'ACTIVE',
      isAvailable: true,
      onboardingStatus: 'COMPLETED',
    };

    if (filter.shopType) {
      baseFilter.shopType = filter.shopType;
    }

    if (filter.categoryIds && filter.categoryIds.length > 0) {
      baseFilter.categoryIds = { $in: filter.categoryIds.map((id) => new Types.ObjectId(id)) };
    }

    const trimmedQuery = query?.trim();

    const buildSearchFilter = (
      q: string,
      serviceShopIds?: Set<string>,
    ): Record<string, unknown> => {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const orConditions: Record<string, unknown>[] = [
        { name: { $regex: escaped, $options: 'i' } },
        { 'address.area': { $regex: escaped, $options: 'i' } },
      ];
      if (serviceShopIds && serviceShopIds.size > 0) {
        orConditions.push({
          _id: { $in: [...serviceShopIds].map((id) => new Types.ObjectId(id)) },
        });
      }
      return { $or: orConditions };
    };

    if (filter.latitude !== undefined && filter.longitude !== undefined) {
      const maxDistance = filter.maxDistanceMeters ?? 10_000;

      const geoFilter = { ...baseFilter };
      if (trimmedQuery) {
        Object.assign(geoFilter, buildSearchFilter(trimmedQuery, filter.serviceShopIds));
      }

      const geoNearStage: PipelineStage = {
        $geoNear: {
          near: { type: 'Point', coordinates: [filter.longitude, filter.latitude] },
          distanceField: 'distance',
          maxDistance,
          query: geoFilter,
          spherical: true,
        },
      };

      const [shops, countResult] = await Promise.all([
        ShopModel.aggregate<IShop & { distance: number }>([
          geoNearStage,
          { $skip: skip },
          { $limit: limit },
        ]).exec(),
        ShopModel.aggregate<{ count: number }>([geoNearStage, { $count: 'count' }]).exec(),
      ]);

      const total = countResult[0]?.count ?? 0;
      return { shops, total };
    }

    // Non-geo path
    const textFilter = { ...baseFilter };
    if (trimmedQuery) {
      Object.assign(textFilter, buildSearchFilter(trimmedQuery, filter.serviceShopIds));
    }

    const [shops, total] = await Promise.all([
      ShopModel.find(textFilter).sort({ 'rating.average': -1 }).skip(skip).limit(limit).exec(),
      ShopModel.countDocuments(textFilter).exec(),
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

  incrementCancellation(shopId: string): Promise<IShop | null> {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return ShopModel.findByIdAndUpdate(
      shopId,
      [
        {
          $set: {
            cancellationCount: { $add: ['$cancellationCount', 1] },
            cancellationsThisWeek: {
              $cond: {
                if: {
                  $or: [
                    { $eq: ['$lastCancellationAt', null] },
                    { $lt: ['$lastCancellationAt', oneWeekAgo] },
                  ],
                },
                then: 1,
                else: { $add: ['$cancellationsThisWeek', 1] },
              },
            },
            lastCancellationAt: new Date(),
          },
        },
      ],
      { returnDocument: 'after', updatePipeline: true },
    ).exec();
  }

  async getCancellationStatsByVendorId(
    vendorId: string,
  ): Promise<{ cancellationCount: number; cancellationsThisWeek: number }> {
    const result = await ShopModel.aggregate([
      {
        $match: {
          vendorId: new Types.ObjectId(vendorId),
          status: { $ne: 'DELETED' },
        },
      },
      {
        $group: {
          _id: null,
          cancellationCount: { $sum: '$cancellationCount' },
          cancellationsThisWeek: { $sum: '$cancellationsThisWeek' },
        },
      },
    ]).exec();

    return result.length > 0
      ? {
          cancellationCount: result[0].cancellationCount,
          cancellationsThisWeek: result[0].cancellationsThisWeek,
        }
      : { cancellationCount: 0, cancellationsThisWeek: 0 };
  }

  updateRating(shopId: string, average: number, count: number): Promise<void> {
    return ShopModel.findByIdAndUpdate(shopId, {
      $set: { 'rating.average': average, 'rating.count': count },
    })
      .exec()
      .then(() => undefined);
  }

  async getAllPhotoUrls(): Promise<string[]> {
    const shops = await ShopModel.find({}, { photos: 1 }).lean().exec();
    const urls: string[] = [];
    for (const s of shops) {
      for (const url of s.photos ?? []) {
        if (url) urls.push(url);
      }
    }
    return urls;
  }
}
