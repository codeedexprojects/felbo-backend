import { z } from 'zod';

export const webhookHeadersSchema = z.object({
  'x-razorpay-signature': z.string().min(1, 'Missing Razorpay signature header'),
});
