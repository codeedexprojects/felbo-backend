export const REDIS_KEY_PREFIX = 'sysconfig:';
export const REDIS_TTL = 604800; // 7 days

export const CONFIG_KEYS = {
  MIN_BOOKING_BUFFER_MINUTES: 'min_booking_buffer_minutes',
  APPOINTMENT_BUFFER_MINUTES: 'appointment_buffer_minutes',
  SLOT_INTERVAL_MINUTES: 'slot_interval_minutes',
  BOOKING_AMOUNT: 'booking_amount',
  FREE_CANCELLATION_WINDOW_MINUTES: 'free_cancellation_window_minutes',
  LATE_CANCELLATION_FEE_PERCENT: 'late_cancellation_fee_percent',
  USER_CANCEL_LIMIT_PER_WEEK: 'user_cancel_limit_per_week',
  USER_BLOCK_DURATION_HOURS: 'user_block_duration_hours',
  VENDOR_CANCEL_WARNING_THRESHOLD_PERCENT: 'vendor_cancel_warning_threshold_percent',
  VENDOR_CANCEL_REVIEW_THRESHOLD_PERCENT: 'vendor_cancel_review_threshold_percent',
  // Search / Geo
  SHOP_MAX_DISTANCE_METERS: 'shop_max_distance_meters',
  RECOMMENDED_SHOPS_MAX_DISTANCE_METERS: 'recommended_shops_max_distance_meters',
  // Barber
  WALK_IN_FALLBACK_DURATION_MINUTES: 'walk_in_fallback_duration_minutes',
  // Issue
  ISSUE_MAX_DISTANCE_METERS: 'issue_max_distance_meters',
  // Cancellation
  SHOP_CANCEL_WEEKLY_LIMIT: 'shop_cancel_weekly_limit',
} as const;

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];
