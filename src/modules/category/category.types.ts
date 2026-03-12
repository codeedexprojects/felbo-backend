export interface CreateCategoryInput {
  name: string;
  image: string;
  displayOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  image?: string;
  displayOrder?: number;
  isActive?: boolean;
  status?: 'ACTIVE' | 'INACTIVE' | 'DELETED';
}

export interface CategoryDto {
  id: string;
  name: string;
  image: string;
  displayOrder: number;
  isActive: boolean;
}

export interface UserCategoryDto {
  id: string;
  name: string;
  image: string;
}

export interface ListUserCategoriesResponse {
  categories: UserCategoryDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
