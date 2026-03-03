import { z } from 'zod';

const timeRegex = /^\d{2}:\d{2}$/;
const timeString = z.string().regex(timeRegex, 'Time must be in HH:mm format');

const breakSchema = z.object({
  start: timeString,
  end: timeString,
  reason: z.string().max(100).optional(),
});

export const createPresetSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  workingHours: z.object({
    start: timeString,
    end: timeString,
  }),
  breaks: z.array(breakSchema).optional().default([]),
});

export const presetIdParamSchema = z.object({
  barberId: z.string().min(1),
  presetId: z.string().min(1),
});

export const setAvailabilitySchema = z.object({
  isWorking: z.boolean(),
  workingHours: z
    .object({
      start: timeString,
      end: timeString,
    })
    .optional(),
  breaks: z.array(breakSchema).optional().default([]),
});

export const barberIdParamSchema = z.object({
  barberId: z.string().min(1),
});
