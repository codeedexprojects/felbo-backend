import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().email('Enter a valid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});
