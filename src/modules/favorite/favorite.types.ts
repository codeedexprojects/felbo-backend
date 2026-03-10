import { ShopAddress } from '../shop/shop.types';

export interface FavoriteDto {
  id: string;
  shopId: string;
  createdAt: Date;
}

export interface FavoriteShopCardDto {
  favoriteId: string;
  shopId: string;
  name: string;
  image: string | null;
  address: ShopAddress;
  topServices: string[];
  isFavorite: true;
}

export interface ListFavoritesResponse {
  favorites: FavoriteShopCardDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
