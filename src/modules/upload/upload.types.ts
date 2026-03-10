// Returned by generateUploadUrlForKey
export interface UploadUrlResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export interface VerifyUploadResponse {
  verified: true;
  viewUrl: string;
  permanentUrl: string;
}
