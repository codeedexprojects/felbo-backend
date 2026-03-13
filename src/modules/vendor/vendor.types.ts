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
  refreshToken: string;
  vendor: {
    id: string;
    phone: string;
    ownerName: string;
    email: string | null;
    profilePhoto: string | null;
    verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAYMENT_PENDING';
  };
  onboardingStatus:
    | 'PENDING_PROFILE'
    | 'PENDING_SERVICES'
    | 'PENDING_BARBERS'
    | 'PENDING_BARBER_SERVICES'
    | 'COMPLETED'
    | null;
  shopDetails?: {
    shopId: string;
    shopName: string;
    address: AddressInput;
    phoneNo: string;
  } | null;
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
  associationMemberId: string;
  associationIdProofUrl: string;
  shopDetails: {
    name: string;
    type: 'MENS' | 'WOMENS' | 'UNISEX';
    address: AddressInput;
    location: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
}

export interface RegisterAssociationResponse {
  message: string;
}

export interface RegisterIndependentInitiateInput {
  phone: string;
  ownerName: string;
  email?: string;
  documents: {
    shopLicense: string;
    ownerIdProof: string;
  };
  shopDetails: {
    name: string;
    type: 'MENS' | 'WOMENS' | 'UNISEX';
    address: AddressInput;
    location: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
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
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAYMENT_PENDING';
  rejectionReason?: string;
  registrationType?: 'ASSOCIATION' | 'INDEPENDENT';
}

export interface OnboardingStatusResponse {
  vendorName: string;
  onboardingStatus:
    | 'PENDING_PROFILE'
    | 'PENDING_SERVICES'
    | 'PENDING_BARBERS'
    | 'PENDING_BARBER_SERVICES'
    | 'COMPLETED'
    | null;
  shopDetails?: {
    shopId: string;
    shopName: string;
    address: AddressInput;
    phoneNo: string;
  } | null;
}

export interface VendorProfileDto {
  id: string;
  phone: string;
  ownerName: string;
  email: string | null;
  profilePhoto: string | null;
  registrationType: 'ASSOCIATION' | 'INDEPENDENT';
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAYMENT_PENDING';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  onboardingStatus:
    | 'PENDING_PROFILE'
    | 'PENDING_SERVICES'
    | 'PENDING_BARBERS'
    | 'PENDING_BARBER_SERVICES'
    | 'COMPLETED'
    | null;
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
  verificationStatus: 'PAYMENT_PENDING';
  status: 'PENDING';
}

export interface ListVendorsFilter {
  page: number;
  limit: number;
  verificationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  search?: string;
  registrationType?: 'ASSOCIATION' | 'INDEPENDENT';
}

export interface VendorListItemDto {
  id: string;
  phone: string;
  ownerName: string;
  email: string | null;
  registrationType: 'ASSOCIATION' | 'INDEPENDENT';
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: Date;

  shopDetails?: {
    name: string;
    type: string;
    address: AddressInput;
  };

  documents?: {
    shopLicense?: string;
    ownerIdProof?: string;
  };

  associationIdProofUrl?: string;
  associationMemberId?: string;
}

export interface VendorStatusCounts {
  total: number;
  active: number;
  pendingVerification: number;
  suspended: number;
}

export interface VendorListSlimDto {
  slNo: number;
  id: string;
  ownerName: string;
  phone: string;
  type: 'ASSOCIATION' | 'INDEPENDENT';
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAYMENT_PENDING';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  registered: Date;
}

export interface ListVendorsResponse {
  vendors: VendorListSlimDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: VendorStatusCounts;
}

export interface VerificationRequestCounts {
  pending: number;
  association: number;
  independent: number;
}

export interface VerificationRequestItemDto {
  slNo: number;
  id: string;
  shopName: string | null;
  ownerName: string;
  phone: string;
  type: 'ASSOCIATION' | 'INDEPENDENT';
  submitted: Date;
}

export interface ListVerificationRequestsResponse {
  vendors: VerificationRequestItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: VerificationRequestCounts;
}

export interface VendorAdminDetail {
  id: string;
  phone: string;
  email: string | null;
  ownerName: string;
  registrationType: 'ASSOCIATION' | 'INDEPENDENT';
  registrationDate: Date;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAYMENT_PENDING';
  verificationNote?: string;
  verifiedAt?: Date;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  isBlocked: boolean;
  isFlagged: boolean;
  documents?: {
    shopLicense?: string;
    ownerIdProof?: string;
  };
  associationMemberId?: string;
  associationIdProofUrl?: string;
  cancellationCount: number;
  cancellationsThisWeek: number;

  shops: {
    id: string;
    name: string;
    shopType: string;
    phone: string;
    address: AddressInput;
    rating: { average: number; count: number };
    onboardingStatus: string;
    status: string;
    isAvailable: boolean;
    photos: string[];

    barbers: {
      id: string;
      name: string;
      phone: string;
      photo?: string;
      isAvailable: boolean;
    }[];
    barberCount: number;

    services: {
      id: string;
      name: string;
      basePrice: number;
      baseDurationMinutes: number;
      description?: string;
    }[];
    serviceCount: number;
  }[];

  recentBookings: unknown[];
}

export interface VendorRequestAdminDetail {
  id: string;
  phone: string;
  email: string | null;
  ownerName: string;
  registrationType: 'ASSOCIATION' | 'INDEPENDENT';
  registrationDate: Date;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAYMENT_PENDING';
  verificationNote?: string;
  associationMemberId?: string;
  associationIdProofUrl?: string;
  registrationPayment?: {
    amount: number;
    paymentId: string;
    paidAt: Date;
  };
  documents?: {
    shopLicense?: string;
    ownerIdProof?: string;
  };
  shopDetails?: {
    name: string;
    type: string;
    address: AddressInput;
    location?: {
      type: 'Point';
      coordinates: [number, number];
    };
    photos: string[];
  };
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

export interface UpdateProfileInput {
  ownerName?: string;
  email?: string;
  profilePhoto?: string;
}

export interface UpdateProfileResponse {
  id: string;
  phone: string;
  ownerName: string;
  email: string | null;
  profilePhoto: string | null;
}

export interface VendorDashboardCountsDto {
  totalBookings: number;
  staffWorking: number;
  staffOnLeave: number;
}

export interface VendorDashboardCountsDto {
  totalBookings: number;
  staffWorking: number;
  staffOnLeave: number;
}
