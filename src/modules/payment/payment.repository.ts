import { ClientSession } from 'mongoose';
import { PaymentModel, IPayment } from './payment.model';
import { CreatePaymentData, RefundEntry } from './payment.types';

export default class PaymentRepository {
  async create(data: CreatePaymentData, session?: ClientSession): Promise<IPayment> {
    const [payment] = await PaymentModel.create([data], { session });
    return payment;
  }

  findByOrderId(razorpayOrderId: string): Promise<IPayment | null> {
    return PaymentModel.findOne({ razorpayOrderId }).exec();
  }

  findByPaymentId(razorpayPaymentId: string): Promise<IPayment | null> {
    return PaymentModel.findOne({ razorpayPaymentId }).exec();
  }

  updatePaymentVerified(
    razorpayOrderId: string,
    data: { razorpayPaymentId: string; razorpaySignature: string; paidAt: Date },
    session?: ClientSession,
  ): Promise<IPayment | null> {
    return PaymentModel.findOneAndUpdate(
      { razorpayOrderId },
      {
        razorpayPaymentId: data.razorpayPaymentId,
        razorpaySignature: data.razorpaySignature,
        paidAt: data.paidAt,
        status: 'PAID',
      },
      { new: true, session },
    ).exec();
  }

  updatePaymentFailed(razorpayOrderId: string, session?: ClientSession): Promise<IPayment | null> {
    return PaymentModel.findOneAndUpdate(
      { razorpayOrderId },
      { status: 'FAILED' },
      { new: true, session },
    ).exec();
  }

  addRefund(
    razorpayPaymentId: string,
    refund: RefundEntry,
    session?: ClientSession,
  ): Promise<IPayment | null> {
    return PaymentModel.findOneAndUpdate(
      { razorpayPaymentId },
      {
        $push: { refunds: refund },
        $set: { status: 'REFUNDED' },
      },
      { new: true, session },
    ).exec();
  }
}
