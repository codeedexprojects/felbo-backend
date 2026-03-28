export const PAID_STATUSES = [
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED_BY_USER',
  'CANCELLED_BY_VENDOR',
  'NO_SHOW',
] as const;

// Statuses that count toward association commission (cancelled bookings excluded)
export const COMMISSION_STATUSES = ['CONFIRMED', 'COMPLETED', 'NO_SHOW'] as const;

export interface FinanceSummaryPeriodDto {
  revenue: number;
  bookingCount: number;
}

export interface RefundStatsDto {
  total: number;
  thisMonth: number;
}

export type RefundType = 'ISSUE' | 'CANCELLATION' | 'COIN';

export interface RefundHistoryItemDto {
  type: 'ISSUE' | 'CANCELLATION';
  amount: number;
  refundStatus: string;
  bookingId: string;
  bookingNumber: string;
  userName: string;
  shopName: string;
  refundedAt: Date;
  reason?: string;
  issueType?: string;
}

export interface CoinRefundHistoryItemDto {
  type: 'COIN_REVERSAL' | 'COIN_REFUND';
  coins: number;
  bookingId?: string;
  bookingNumber?: string;
  userName: string;
  userPhone: string;
  refundedAt: Date;
  description: string;
}

export interface RefundHistoryResponse {
  refunds: RefundHistoryItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CoinRefundHistoryResponse {
  refunds: CoinRefundHistoryItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RefundHistoryParams {
  type?: RefundType;
  page: number;
  limit: number;
  from?: Date;
  to?: Date;
}

export interface RegistrationRevenueSummaryDto {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
}

export interface FinanceSummaryDto {
  today: FinanceSummaryPeriodDto;
  thisWeek: FinanceSummaryPeriodDto;
  thisMonth: FinanceSummaryPeriodDto;
  total: FinanceSummaryPeriodDto;
  associationCommission: number;
  refundStats: RefundStatsDto;
  registrationRevenue: RegistrationRevenueSummaryDto;
}

export interface RevenueChartPointDto {
  date: string;
  revenue: number;
  bookingCount: number;
  registrationRevenue: number;
}

export interface VendorRevenueTableParams {
  from: Date;
  to: Date;
  search?: string;
  sortOrder: 'asc' | 'desc';
  minRevenue?: number;
  maxRevenue?: number;
  page: number;
  limit: number;
}

export interface VendorRevenueRowDto {
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  registrationType: 'ASSOCIATION' | 'INDEPENDENT';
  shopCount: number;
  bookingCount: number;
  revenue: number;
  registrationAmount: number | null;
}

export interface VendorRevenueTableResponse {
  vendors: VendorRevenueRowDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AssocFinanceSummaryDto {
  vendorCount: number;
  today: FinanceSummaryPeriodDto;
  thisWeek: FinanceSummaryPeriodDto;
  thisMonth: FinanceSummaryPeriodDto;
  total: FinanceSummaryPeriodDto;
}

export interface IndependentRegistrationRowDto {
  vendorId: string;
  vendorName: string;
  vendorPhone: string;
  verificationStatus: string;
  registrationAmount: number;
  netRevenue: number;
  paidAt: Date;
}

export interface IndependentRegistrationListParams {
  page: number;
  limit: number;
  search?: string;
  from?: Date;
  to?: Date;
  verificationStatus?: string;
}

export interface IndependentRegistrationListResponse {
  registrations: IndependentRegistrationRowDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
