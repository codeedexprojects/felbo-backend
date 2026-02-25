export interface CreateAdInput {
  title: string;
  subtitle: string;
  description: string;
  bannerImage: string;
  shopId: string;
  priority?: number;
}

export interface UpdateAdInput {
  title?: string;
  subtitle?: string;
  description?: string;
  bannerImage?: string;
  shopId?: string;
  priority?: number;
  isActive?: boolean;
}

export interface AdDto {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  bannerImage: string;
  shopId: string;
  createdBy: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListAdsFilter {
  page: number;
  limit: number;
}

export interface ListAdsResponse {
  ads: AdDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
