export const PAID_STATUSES = [
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED_BY_USER',
  'CANCELLED_BY_VENDOR',
  'NO_SHOW',
] as const;

export interface FinanceSummaryPeriodDto {
  revenue: number;
  bookingCount: number;
}

export interface RefundStatsDto {
  total: number;
  thisMonth: number;
}

export type RefundType = 'ISSUE' | 'CANCELLATION';

export interface RefundHistoryItemDto {
  type: RefundType;
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

export interface RefundHistoryResponse {
  refunds: RefundHistoryItemDto[];
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

export interface FinanceSummaryDto {
  today: FinanceSummaryPeriodDto;
  thisWeek: FinanceSummaryPeriodDto;
  thisMonth: FinanceSummaryPeriodDto;
  total: FinanceSummaryPeriodDto;
  associationCommission: number;
  refundStats: RefundStatsDto;
}

export interface RevenueChartPointDto {
  date: string;
  revenue: number;
  bookingCount: number;
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
