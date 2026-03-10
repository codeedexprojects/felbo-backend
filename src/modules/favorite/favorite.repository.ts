import { UserFavoriteModel, IUserFavorite } from './favorite.model';

export class FavoriteRepository {
  async create(userId: string, shopId: string): Promise<IUserFavorite> {
    return UserFavoriteModel.create({ userId, shopId });
  }

  async delete(userId: string, shopId: string): Promise<boolean> {
    const result = await UserFavoriteModel.deleteOne({ userId, shopId });
    return result.deletedCount > 0;
  }

  async findByUserId(
    userId: string,
    skip: number,
    limit: number,
  ): Promise<{ favorites: IUserFavorite[]; total: number }> {
    const [favorites, total] = await Promise.all([
      UserFavoriteModel.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      UserFavoriteModel.countDocuments({ userId }),
    ]);
    return { favorites: favorites as unknown as IUserFavorite[], total };
  }

  async getFavoriteShopIds(userId: string): Promise<Set<string>> {
    const favorites = await UserFavoriteModel.find({ userId }, { shopId: 1 }).lean();
    return new Set(favorites.map((f) => f.shopId.toString()));
  }
}
