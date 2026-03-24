import { IBookingIssue } from './issue.model';

export interface PopulatedBookingIssue extends Omit<
  IBookingIssue,
  'bookingId' | 'userId' | 'vendorId' | 'shopId'
> {
  bookingId: {
    _id: { toString(): string };
    bookingNumber: string;
    paymentMethod: 'RAZORPAY' | 'FELBO_COINS';
    advancePaid: number;
  } | null;
  userId: { _id: { toString(): string }; name: string; phone: string } | null;
  vendorId: {
    _id: { toString(): string };
    ownerName: string;
    phone: string;
    isFlagged: boolean;
  } | null;
  shopId: {
    _id: { toString(): string };
    name: string;
    phone: string;
    address: { area: string; city: string };
  } | null;
}

export interface ListIssuesFilter {
  status?: IssueStatus;
  type?: IssueType;
  page: number;
  limit: number;
}

export interface IssueDTO {
  slNo: number;
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
  razorpayPaymentId?: string;
}
export type RefundStatus = 'NONE' | 'PENDING' | 'ISSUED' | 'COMPLETED' | 'FAILED';

// Lean document shape returned by findByUserIdPaginated
export interface UserIssueListItem {
  _id: { toString(): string };
  shopId: { _id: unknown; name: string } | null;
  bookingId: { _id: unknown; bookingNumber: string } | null;
  type: IssueType;
  status: IssueStatus;
  description: string;
  refundStatus: RefundStatus;
  createdAt: Date;
}

export interface UserIssueListItemDTO {
  id: string;
  type: IssueType;
  status: IssueStatus;
  description: string;
  shopName: string | null;
  bookingNumber: string | null;
  refundStatus: RefundStatus;
  createdAt: Date;
}

export interface UserIssueDetailDTO {
  id: string;
  type: IssueType;
  status: IssueStatus;
  description: string;
  shop: { id: string; name: string; address: { area: string; city: string } } | null;
  bookingNumber: string | null;
  refund: {
    status: RefundStatus;
    method: 'RAZORPAY' | 'FELBO_COINS' | null;
    amount: number | null;
  };
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserIssueListResponse {
  issues: UserIssueListItemDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IssueDetailDTO {
  id: string;
  bookingNumber: string | null;
  user: { id: string; name: string; phone: string } | null;
  vendor: { id: string; name: string; phone: string; isFlagged: boolean } | null;
  shop: { id: string; name: string; phone: string; address: { area: string; city: string } } | null;
  barberId: string | null;
  type: IssueType;
  description: string;
  status: IssueStatus;
  refund: {
    status: RefundStatus;
    method: 'RAZORPAY' | 'FELBO_COINS' | null;
    amount: number | null;
    coins: number | null;
    refundId: string | null;
  };
  userLocation: { lat: number; lng: number } | null;
  reviewedBy: string | null;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}
