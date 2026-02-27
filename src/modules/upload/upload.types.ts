export interface GenerateUploadUrlInput {
  vendorId: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  fileSizeBytes: number;
}

export interface GenerateUploadUrlResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export interface VerifyUploadInput {
  vendorId: string;
  key: string;
}

export interface VerifyUploadResponse {
  verified: true;
  viewUrl: string;
}
