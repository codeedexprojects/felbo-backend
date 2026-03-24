export type CoinTransactionType =
  | 'COIN_EARNED'
  | 'COIN_REDEEMED'
  | 'COIN_REFUND'
  | 'COIN_REVERSAL'
  | 'ADMIN_CREDIT'
  | 'ADMIN_DEBIT';
export type CoinTransactionDirection = 'CREDIT' | 'DEBIT';

export interface FelboCoinTransactionDto {
  type: CoinTransactionType;
  direction: CoinTransactionDirection;
  coins: number;
  description: string;
  date: Date;
}

export interface FelboCoinOverviewDto {
  totalCoins: number;
  transactions: FelboCoinTransactionDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreditCoinsInput {
  userId: string;
  coins: number;
  // COIN_REVERSAL covers the case where barber cancels a FelboCoin-paid booking (returning the debited coins)
  type: 'COIN_EARNED' | 'COIN_REFUND' | 'COIN_REVERSAL';
  bookingId?: string;
  bookingNumber?: string;
  description: string;
}

export interface DebitCoinsInput {
  userId: string;
  coins: number;
  type: 'COIN_REDEEMED';
  bookingId?: string;
  bookingNumber?: string;
  description: string;
}

export interface AdminCreditCoinsInput {
  adminId: string;
  userId: string;
  coins: number;
  reason: string;
}

export interface AdminDebitCoinsInput {
  adminId: string;
  userId: string;
  coins: number;
  reason: string;
}

export interface AdminCoinStatsDto {
  totalCoinsInCirculation: number;
  totalUsersWithCoins: number;
  totalTransactions: number;
  totalEarned: number;
  totalRedeemed: number;
  totalRefunded: number;
  totalReversed: number;
  totalAdminCredit: number;
  totalAdminDebit: number;
  netCoinsIssued: number;
}

export interface AdminTransactionDto {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  type: CoinTransactionType;
  direction: CoinTransactionDirection;
  coins: number;
  balanceBefore: number;
  balanceAfter: number;
  bookingNumber?: string;
  adminId?: string;
  description: string;
  createdAt: Date;
}

export interface AdminTransactionListDto {
  transactions: AdminTransactionDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CoinTrendBucketDto {
  date: string;
  coinsEarned: number;
  coinsRedeemed: number;
  coinsRefunded: number;
  coinsReversed: number;
  adminCredit: number;
  adminDebit: number;
  netFlow: number;
}

export interface CoinUserLeaderboardItemDto {
  userId: string;
  name: string;
  phone: string;
  email: string | null;
  felboCoinBalance: number;
}

export interface CoinUserLeaderboardDto {
  users: CoinUserLeaderboardItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminLogDto {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  adminId: string;
  adminName: string;
  type: 'ADMIN_CREDIT' | 'ADMIN_DEBIT';
  direction: CoinTransactionDirection;
  coins: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: Date;
}

export interface AdminLogListDto {
  logs: AdminLogDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
