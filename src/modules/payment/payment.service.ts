import crypto from 'crypto';
import Razorpay from 'razorpay';
import { Logger } from 'winston';
import PaymentRepository from './payment.repository';
import { CreateOrderInput, CreateOrderResult, VerifyPaymentInput } from './payment.types';
import { ValidationError, NotFoundError } from '../../shared/errors/index';

export default class PaymentService {
  private readonly razorpay: InstanceType<typeof Razorpay>;

  constructor(
    private readonly paymentRepository: PaymentRepository,
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
    const expectedSignature = crypto
      .createHmac('sha256', this.razorpayKeySecret)
      .update(`${input.orderId}|${input.paymentId}`)
      .digest('hex');

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

  async refundIssuePayment(razorpayPaymentId: string): Promise<string> {
    const ISSUE_REFUND_PAISE = 1000; // ₹10

    const refund = await this.razorpay.payments.refund(razorpayPaymentId, {
      amount: ISSUE_REFUND_PAISE,
      notes: { reason: 'Issue refund' },
    });

    this.logger.info({
      action: 'ISSUE_REFUND_INITIATED',
      module: 'payment',
      paymentId: razorpayPaymentId,
      refundId: refund.id,
      amountPaise: ISSUE_REFUND_PAISE,
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

    this.logger.info({
      action: 'WEBHOOK_RECEIVED',
      module: 'payment',
      eventType,
    });

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
    }

    if (eventType === 'refund.processed') {
      const refundEntity = event.payload?.refund?.entity;
      if (refundEntity?.payment_id && refundEntity?.id) {
        const payment = await this.paymentRepository.findByPaymentId(refundEntity.payment_id);
        if (payment) {
          const refundEntry = payment.refunds.find((r) => r.razorpayRefundId === refundEntity.id);
          if (refundEntry) {
            refundEntry.status = 'PROCESSED';
            refundEntry.processedAt = new Date();
            await payment.save();
          }
        }
        this.logger.info({
          action: 'REFUND_PROCESSED',
          module: 'payment',
          refundId: refundEntity.id,
          paymentId: refundEntity.payment_id,
        });
      }
    }
  }
}
