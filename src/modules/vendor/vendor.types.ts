export interface SendOtpInput {
  phone: string;
}

export interface SendOtpResponse {
  sessionId: string;
  message: string;
}

export interface LoginVerifyOtpInput {
  phone: string;
  otp: string;
  sessionId: string;
}

export interface LoginVerifyOtpResponse {
  token: string;
  vendor: {
    id: string;
    phone: string;
    ownerName: string;
    email: string | null;
  };
}

export interface RegisterVerifyOtpInput {
  phone: string;
  otp: string;
  sessionId: string;
}

export interface RegisterVerifyOtpResponse {
  verified: true;
  message: string;
}

export interface AddressInput {
  line1: string;
  line2?: string;
  area: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
}

export interface RegisterAssociationInput {
  phone: string;
  ownerName: string;
  email?: string;
  shopName: string;
  shopType: 'MENS' | 'WOMENS' | 'UNISEX';
  address: AddressInput;
  location: { longitude: number; latitude: number };
  memberId: string;
  idProofUrl: string;
}

export interface RegisterAssociationResponse {
  message: string;
}

export interface RegisterIndependentInitiateInput {
  phone: string;
  ownerName: string;
  email?: string;
  shopName: string;
  shopType: 'MENS' | 'WOMENS' | 'UNISEX';
  address: AddressInput;
  location: { longitude: number; latitude: number };
  shopLicenseUrl: string;
  ownerIdProofUrl: string;
}

export interface RegisterIndependentInitiateResponse {
  orderId: string;
  amount: number;
}

export interface RegisterIndependentConfirmInput {
  phone: string;
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface RegisterIndependentConfirmResponse {
  message: string;
}

export interface RegistrationStatusResponse {
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  registrationType?: 'ASSOCIATION' | 'INDEPENDENT';
}

export interface VendorProfileDto {
  id: string;
  phone: string;
  ownerName: string;
  email: string | null;
  registrationType: 'ASSOCIATION' | 'INDEPENDENT';
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
}

export interface CreateVendorData {
  phone: string;
  ownerName: string;
  email?: string;
  registrationType: 'ASSOCIATION' | 'INDEPENDENT';
  associationMemberId?: string;
  associationIdProofUrl?: string;
  documents?: {
    shopLicense?: string;
    ownerIdProof?: string;
  };
  shopDetails?: {
    name: string;
    type: 'MENS' | 'WOMENS' | 'UNISEX';
    address: AddressInput;
    location: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
  registrationPaymentOrderId?: string;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
}

export interface UpsertVendorData {
  ownerName: string;
  email?: string;
  registrationType: 'INDEPENDENT';
  documents?: {
    shopLicense?: string;
    ownerIdProof?: string;
  };
  shopDetails?: {
    name: string;
    type: 'MENS' | 'WOMENS' | 'UNISEX';
    address: AddressInput;
    location: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
  registrationPaymentOrderId?: string;
  verificationStatus: 'PENDING';
  status: 'PENDING';
}
