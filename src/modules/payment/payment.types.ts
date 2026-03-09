export type PaymentPurpose = 'VENDOR_REGISTRATION' | 'BOOKING_ADVANCE';

export type PaymentStatus = 'CREATED' | 'PAID' | 'FAILED' | 'REFUNDED';

export interface CreatePaymentData {
  razorpayOrderId: string;
  purpose: PaymentPurpose;
  amountPaise: number;
  currency: string;
  phone?: string;
  userId?: string;
  shopId?: string;
  receipt: string;
  notes?: Record<string, string>;
  status: PaymentStatus;
}

export interface RefundEntry {
  razorpayRefundId: string;
  amountPaise: number;
  status: 'INITIATED' | 'PROCESSED' | 'FAILED';
  initiatedAt: Date;
  processedAt?: Date;
}

export interface CreateOrderInput {
  phone: string;
  amountRupees: number;
}

export interface CreateBookingPaymentInput {
  userId: string;
  shopId: string;
  amountRupees: number;
}

export interface CreateOrderResult {
  orderId: string;
}

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
}
