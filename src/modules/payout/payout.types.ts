import { IPayout } from './payout.model';

export interface PayoutDashboardDto {
  owedAmount: number;
  totalCommission: number;
  totalPaid: number;
  bookingCount: number;
  lastPayoutDate: Date | null;
}

export interface PayoutItemDto {
  id: string;
  amount: number;
  bookingCount: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  requestedBy: string;
  processedBy: string | null;
  rejectionReason: string | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PayoutListResponse {
  payouts: PayoutItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PayoutAssocSummaryDto {
  pendingAmount: number;
  bookingCount: number;
}

export interface PayoutListParams {
  status?: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  page: number;
  limit: number;
}

export function mapPayoutToDto(payout: IPayout): PayoutItemDto {
  return {
    id: payout._id.toString(),
    amount: payout.amount,
    bookingCount: payout.bookingCount,
    status: payout.status,
    requestedBy: payout.requestedBy.toString(),
    processedBy: payout.processedBy ? payout.processedBy.toString() : null,
    rejectionReason: payout.rejectionReason ?? null,
    processedAt: payout.processedAt ?? null,
    createdAt: payout.createdAt,
    updatedAt: payout.updatedAt,
  };
}
