export interface ReviewDto {
  id: string;
  bookingId: string;
  userId: string;
  shopId: string;
  barberId: string;
  rating: number;
  description?: string;
  status: string;
  createdAt: Date;
}

export interface ShopReviewsResponse {
  reviews: ReviewDto[];
  average: number;
  count: number;
  page: number;
  limit: number;
  total: number;
}
