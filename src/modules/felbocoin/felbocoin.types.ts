export type CoinTransactionType = 'COIN_EARNED' | 'COIN_REDEEMED' | 'COIN_REFUND' | 'COIN_REVERSAL';
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
