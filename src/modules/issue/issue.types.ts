export interface ListIssuesFilter {
  status?: IssueStatus;
  type?: IssueType;
  page: number;
  limit: number;
}

export interface IssueDTO {
  id: string;
  bookingId: string;
  userId: string;
  shopId: string;
  vendorId: string;
  barberId?: string | null;
  type: IssueType;
  description: string;
  status: IssueStatus;
  reviewedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueStatusCounts {
  total: number;
  open: number;
  resolved: number;
  rejected: number;
}

export interface ListIssuesResponse {
  issues: IssueDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: IssueStatusCounts;
}

export interface UpdateIssueStatusInput {
  status: 'RESOLVED' | 'REJECTED';
  reason: string;
}

export type IssueStatus = 'OPEN' | 'RESOLVED' | 'REJECTED';
export type IssueType =
  | 'SHOP_CLOSED'
  | 'BARBER_UNAVAILABLE'
  | 'EXCESSIVE_WAIT'
  | 'SERVICE_NOT_PROVIDED'
  | 'QUALITY_ISSUE'
  | 'OTHER';

export interface CreateIssueInput {
  bookingId: string;
  shopId: string;
  type: IssueType;
  description: string;
  userLocation: { lat: number; lng: number };
  photoUrl?: string;
  razorpayPaymentId?: string;
}
export type RefundStatus = 'NONE' | 'PENDING' | 'ISSUED' | 'FAILED';

export interface IssueDetailDTO {
  id: string;
  bookingId: string;
  user: { id: string; name: string; phone: string } | null;
  vendor: { id: string; name: string; phone: string; isFlagged: boolean } | null;
  shop: { id: string; name: string; phone: string; address: { area: string; city: string } } | null;
  barberId: string | null;
  type: IssueType;
  description: string;
  status: IssueStatus;
  refundStatus: RefundStatus;
  refundId: string | null;
  razorpayPaymentId: string | null;
  userLocation: { lat: number; lng: number } | null;
  photoUrl: string | null;
  reviewedBy: string | null;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}
