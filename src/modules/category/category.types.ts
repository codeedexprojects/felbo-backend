export interface CreateCategoryInput {
  name: string;
  displayOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  displayOrder?: number;
  isActive?: boolean;
}

export interface CategoryDto {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}
