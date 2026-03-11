import { FavoriteRepository } from './favorite.repository';
import { FavoriteDto, FavoriteShopCardDto, ListFavoritesResponse } from './favorite.types';
import { IUserFavorite } from './favorite.model';
import { NotFoundError } from '../../shared/errors';
import ShopService from '../shop/shop.service';

export class FavoriteService {
  constructor(
    private readonly favoriteRepository: FavoriteRepository,
    private readonly getShopService: () => ShopService,
  ) {}

  private get shopService(): ShopService {
    return this.getShopService();
  }

  private toDto(favorite: IUserFavorite): FavoriteDto {
    return {
      id: favorite._id.toString(),
      shopId: favorite.shopId.toString(),
      createdAt: favorite.createdAt,
    };
  }

  async addFavorite(userId: string, shopId: string): Promise<FavoriteDto> {
    await this.shopService.getShopById(shopId);

    const favorite = await this.favoriteRepository.create(userId, shopId);
    return this.toDto(favorite);
  }

  async removeFavorite(userId: string, shopId: string): Promise<void> {
    const deleted = await this.favoriteRepository.delete(userId, shopId);
    if (!deleted) {
      throw new NotFoundError('Favorite not found.');
    }
  }

  async getFavoriteShopIds(userId: string): Promise<Set<string>> {
    return this.favoriteRepository.getFavoriteShopIds(userId);
  }

  async listFavorites(userId: string, page: number, limit: number): Promise<ListFavoritesResponse> {
    const skip = (page - 1) * limit;
    const { favorites, total } = await this.favoriteRepository.findByUserId(userId, skip, limit);

    const shopIds = favorites.map((f) => f.shopId.toString());

    if (shopIds.length === 0) {
      return { favorites: [], total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    const [shops, allServices] = await Promise.all([
      this.shopService.getShopsByIds(shopIds),
      this.shopService.getServicesByShopIds(shopIds),
    ]);

    const shopMap = new Map(shops.map((s) => [s.id, s]));

    const servicesByShopId = new Map<string, string[]>();
    for (const svc of allServices) {
      if (!servicesByShopId.has(svc.shopId)) servicesByShopId.set(svc.shopId, []);
      const names = servicesByShopId.get(svc.shopId)!;
      if (names.length < 3) names.push(svc.name);
    }

    const result = favorites
      .map((fav): FavoriteShopCardDto | null => {
        const shopId = fav.shopId.toString();
        const shop = shopMap.get(shopId);
        if (!shop) return null;
        return {
          favoriteId: fav._id.toString(),
          shopId,
          name: shop.name,
          image: shop.photos?.[0] ?? null,
          address: shop.address,
          topServices: servicesByShopId.get(shopId) ?? [],
          isFavorite: true as const,
          rating: shop.rating,
        };
      })
      .filter((item): item is FavoriteShopCardDto => item !== null);

    return { favorites: result, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
