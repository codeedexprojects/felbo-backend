import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeString = z.string().regex(timeRegex, 'Time must be in HH:mm format (00:00–23:59)');

const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const breakSchema = z
  .object({
    start: timeString,
    end: timeString,
    reason: z.string().max(100).optional(),
  })
  .refine((b) => toMinutes(b.start) < toMinutes(b.end), {
    message: 'Break start must be before break end',
    path: ['end'],
  });

const workingHoursSchema = z
  .object({
    start: timeString,
    end: timeString,
  })
  .refine((wh) => toMinutes(wh.start) < toMinutes(wh.end), {
    message: 'Working hours start must be before end',
    path: ['end'],
  });

export const createPresetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  workingHours: workingHoursSchema,
  breaks: z.array(breakSchema).optional().default([]),
});

export const presetIdParamSchema = z.object({
  barberId: z.string().min(1),
  presetId: z.string().min(1),
});

export const setAvailabilitySchema = z
  .object({
    isWorking: z.boolean(),
    workingHours: workingHoursSchema.optional(),
    breaks: z.array(breakSchema).optional().default([]),
  })
  .refine((data) => !data.isWorking || data.workingHours !== undefined, {
    message: 'workingHours is required when isWorking is true',
    path: ['workingHours'],
  })
  .refine((data) => data.isWorking || data.workingHours === undefined, {
    message: 'workingHours must not be provided when isWorking is false',
    path: ['workingHours'],
  })
  .refine((data) => data.isWorking || (data.breaks ?? []).length === 0, {
    message: 'breaks must not be provided when isWorking is false',
    path: ['breaks'],
  });

export const barberIdParamSchema = z.object({
  barberId: z.string().min(1),
});
