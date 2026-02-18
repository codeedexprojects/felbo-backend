import { Request, Response } from 'express';
import PaymentService from './payment.service';
import { webhookHeadersSchema } from './payment.validators';

export default class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    const { 'x-razorpay-signature': signature } = webhookHeadersSchema.parse(req.headers);
    const rawBody = JSON.stringify(req.body);

    await this.paymentService.handleWebhook(rawBody, signature);

    res.status(200).json({ status: 'ok' });
  };
}
