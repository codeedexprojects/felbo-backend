export interface ReviewDto {
  id: string;
  username: string;
  image?: string | null;
  rating: number;
  description?: string;
  date: Date;
}

export interface ShopReviewsResponse {
  reviews: ReviewDto[];
  average: number;
  count: number;
  page: number;
  limit: number;
  total: number;
}
