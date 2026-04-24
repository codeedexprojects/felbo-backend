import { hmacSha256 } from '../../shared/utils/token';
import Razorpay from 'razorpay';
import { Logger } from 'winston';
import { ClientSession } from '../../shared/database/transaction';
import PaymentRepository from './payment.repository';
import {
  CreateOrderInput,
  CreateOrderResult,
  VerifyPaymentInput,
  CreateBookingPaymentInput,
} from './payment.types';
import { ValidationError, NotFoundError } from '../../shared/errors/index';
import { IssueService } from '../issue/issue.service';
import { BookingRepository } from '../booking/booking.repository';

export default class PaymentService {
  readonly razorpay: InstanceType<typeof Razorpay>;

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly getIssueService: () => IssueService,
    private readonly getBookingRepository: () => BookingRepository,
    private readonly razorpayKeyId: string,
    private readonly razorpayKeySecret: string,
    private readonly webhookSecret: string,
    private readonly logger: Logger,
  ) {
    this.razorpay = new Razorpay({
      key_id: this.razorpayKeyId,
      key_secret: this.razorpayKeySecret,
    });
  }

  private get issueService(): IssueService {
    return this.getIssueService();
  }

  private get bookingRepository(): BookingRepository {
    return this.getBookingRepository();
  }

  async createBookingAdvanceOrder(input: CreateBookingPaymentInput): Promise<CreateOrderResult> {
    const amountPaise = input.amountRupees * 100;
    const receipt = `bk_${input.userId.slice(-6)}_${Date.now()}`;

    const order = await this.razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: { purpose: 'BOOKING_ADVANCE', userId: input.userId, shopId: input.shopId },
    });

    this.logger.info({
      action: 'PAYMENT_ORDER_CREATED',
      module: 'payment',
      purpose: 'BOOKING_ADVANCE',
      orderId: order.id,
      amountPaise,
      userId: input.userId,
    });

    return { orderId: order.id, receipt };
  }

  async saveBookingPaymentRecord(
    input: CreateBookingPaymentInput & { orderId: string; receipt: string },
    session?: ClientSession,
  ): Promise<void> {
    const amountPaise = input.amountRupees * 100;
    await this.paymentRepository.create(
      {
        razorpayOrderId: input.orderId,
        purpose: 'BOOKING_ADVANCE',
        amountPaise,
        currency: 'INR',
        userId: input.userId,
        shopId: input.shopId,
        receipt: input.receipt,
        notes: { purpose: 'BOOKING_ADVANCE', userId: input.userId, shopId: input.shopId },
        status: 'CREATED',
      },
      session,
    );
  }

  async verifyBookingPayment(input: VerifyPaymentInput, session?: ClientSession): Promise<void> {
    const expectedSignature = hmacSha256(
      this.razorpayKeySecret,
      `${input.orderId}|${input.paymentId}`,
    );

    if (expectedSignature !== input.signature) {
      this.logger.warn({
        action: 'PAYMENT_SIGNATURE_MISMATCH',
        module: 'payment',
        orderId: input.orderId,
      });
      throw new ValidationError('Payment verification failed. Invalid signature.');
    }

    const payment = await this.paymentRepository.findByOrderId(input.orderId);
    if (!payment) {
      throw new NotFoundError('Payment record not found for this order.');
    }

    if (payment.status === 'PAID') {
      return;
    }

    await this.paymentRepository.updatePaymentVerified(
      input.orderId,
      {
        razorpayPaymentId: input.paymentId,
        razorpaySignature: input.signature,
        paidAt: new Date(),
      },
      session,
    );

    this.logger.info({
      action: 'PAYMENT_VERIFIED',
      module: 'payment',
      purpose: 'BOOKING_ADVANCE',
      orderId: input.orderId,
      paymentId: input.paymentId,
    });
  }

  async createVendorRegistrationOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const amountPaise = input.amountRupees * 100;
    const receipt = `vendor_reg_${input.phone}_${Date.now()}`;

    const order = await this.razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        purpose: 'VENDOR_REGISTRATION',
        phone: input.phone,
      },
    });

    await this.paymentRepository.create({
      razorpayOrderId: order.id,
      purpose: 'VENDOR_REGISTRATION',
      amountPaise,
      currency: 'INR',
      phone: input.phone,
      receipt,
      notes: { purpose: 'VENDOR_REGISTRATION', phone: input.phone },
      status: 'CREATED',
    });

    this.logger.info({
      action: 'PAYMENT_ORDER_CREATED',
      module: 'payment',
      orderId: order.id,
      amountPaise,
      phone: input.phone.slice(-4),
    });

    return { orderId: order.id };
  }

  async verifyVendorRegistrationPayment(input: VerifyPaymentInput): Promise<void> {
    const expectedSignature = hmacSha256(
      this.razorpayKeySecret,
      `${input.orderId}|${input.paymentId}`,
    );

    if (expectedSignature !== input.signature) {
      this.logger.warn({
        action: 'PAYMENT_SIGNATURE_MISMATCH',
        module: 'payment',
        orderId: input.orderId,
      });
      throw new ValidationError('Payment verification failed. Invalid signature.');
    }

    const payment = await this.paymentRepository.findByOrderId(input.orderId);
    if (!payment) {
      throw new NotFoundError('Payment record not found for this order.');
    }

    if (payment.status === 'PAID') {
      return;
    }

    await this.paymentRepository.updatePaymentVerified(input.orderId, {
      razorpayPaymentId: input.paymentId,
      razorpaySignature: input.signature,
      paidAt: new Date(),
    });

    this.logger.info({
      action: 'PAYMENT_VERIFIED',
      module: 'payment',
      orderId: input.orderId,
      paymentId: input.paymentId,
    });
  }

  async refundVendorRegistrationPayment(razorpayPaymentId: string): Promise<void> {
    const payment = await this.paymentRepository.findByPaymentId(razorpayPaymentId);
    if (!payment) {
      this.logger.warn({
        action: 'PAYMENT_REFUND_NOT_FOUND',
        module: 'payment',
        paymentId: razorpayPaymentId,
      });
      return;
    }

    if (payment.status === 'REFUNDED') {
      this.logger.info({
        action: 'PAYMENT_ALREADY_REFUNDED',
        module: 'payment',
        paymentId: razorpayPaymentId,
      });
      return;
    }

    const refund = await this.razorpay.payments.refund(razorpayPaymentId, {
      amount: payment.amountPaise,
      notes: { reason: 'Vendor registration rejected' },
    });

    await this.paymentRepository.addRefund(razorpayPaymentId, {
      razorpayRefundId: refund.id,
      amountPaise: payment.amountPaise,
      status: 'INITIATED',
      initiatedAt: new Date(),
    });

    this.logger.info({
      action: 'PAYMENT_REFUND_INITIATED',
      module: 'payment',
      paymentId: razorpayPaymentId,
      refundId: refund.id,
      amountPaise: payment.amountPaise,
    });
  }

  async refundBookingAdvance(razorpayPaymentId: string, amountPaise: number): Promise<string> {
    const refund = await this.razorpay.payments.refund(razorpayPaymentId, {
      amount: amountPaise,
      notes: { reason: 'Booking cancelled by barber' },
    });

    this.logger.info({
      action: 'BOOKING_ADVANCE_REFUND_INITIATED',
      module: 'payment',
      paymentId: razorpayPaymentId,
      refundId: refund.id,
      amountPaise,
    });

    return refund.id;
  }

  async refundIssuePayment(razorpayPaymentId: string, amountPaise: number): Promise<string> {
    const refund = await this.razorpay.payments.refund(razorpayPaymentId, {
      amount: amountPaise,
      notes: { reason: 'Issue refund' },
    });

    this.logger.info({
      action: 'ISSUE_REFUND_INITIATED',
      module: 'payment',
      paymentId: razorpayPaymentId,
      refundId: refund.id,
      amountPaise,
    });

    return refund.id;
  }

  async handleWebhook(rawBody: string, signature: string): Promise<void> {
    const isValid = Razorpay.validateWebhookSignature(rawBody, signature, this.webhookSecret);
    if (!isValid) {
      throw new ValidationError('Invalid webhook signature.');
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.event;

    this.logger.info({ action: 'WEBHOOK_RECEIVED', module: 'payment', eventType });

    if (eventType === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity;
      if (paymentEntity?.order_id) {
        await this.paymentRepository.updatePaymentFailed(paymentEntity.order_id);
        this.logger.info({
          action: 'PAYMENT_MARKED_FAILED',
          module: 'payment',
          orderId: paymentEntity.order_id,
        });
      }
      return;
    }

    if (eventType === 'refund.processed' || eventType === 'refund.failed') {
      const refundEntity = event.payload?.refund?.entity;
      const refundId: string | undefined = refundEntity?.id;
      const paymentId: string | undefined = refundEntity?.payment_id;

      if (!refundId || !paymentId) return;

      const succeeded = eventType === 'refund.processed';

      // 1. Update the refund entry inside the Payment document
      const payment = await this.paymentRepository.findByPaymentId(paymentId);
      if (payment) {
        const refundEntry = payment.refunds.find((r) => r.razorpayRefundId === refundId);
        if (refundEntry) {
          refundEntry.status = succeeded ? 'PROCESSED' : 'FAILED';
          if (succeeded) refundEntry.processedAt = new Date();
          await payment.save();
        } else {
          this.logger.warn({
            action: 'WEBHOOK_REFUND_ENTRY_NOT_FOUND',
            module: 'payment',
            refundId,
            paymentId,
          });
        }
      }

      // 2. Update booking cancellation refundStatus (barber-cancelled Razorpay bookings)
      if (succeeded) {
        await this.bookingRepository.markCancellationRefundCompleted(refundId);
        await this.issueService.markIssueRefundCompleted(refundId);
      } else {
        await this.bookingRepository.markCancellationRefundFailed(refundId);
        this.logger.warn({
          action: 'REFUND_FAILED',
          module: 'payment',
          refundId,
          paymentId,
        });
      }

      this.logger.info({
        action: succeeded ? 'REFUND_PROCESSED' : 'REFUND_FAILED',
        module: 'payment',
        refundId,
        paymentId,
      });
      return;
    }

    this.logger.info({ action: 'WEBHOOK_EVENT_IGNORED', module: 'payment', eventType });
  }
}
