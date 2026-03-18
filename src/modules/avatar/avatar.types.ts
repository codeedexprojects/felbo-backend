export interface AvatarDto {
  id: string;
  imageUrl: string;
  createdAt: Date;
}

export interface AddAvatarInput {
  key: string;
}

export interface ListAvatarsResponse {
  avatars: AvatarDto[];
}

export interface DeleteAvatarResponse {
  message: string;
}
