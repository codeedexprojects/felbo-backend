import { SeedConfigItem } from '../../modules/config/config.types';
import { CONFIG_KEYS } from './config.keys';

export const DEFAULT_CONFIGS: SeedConfigItem[] = [
  // Booking Settings
  {
    key: CONFIG_KEYS.MIN_BOOKING_BUFFER_MINUTES,
    value: '30',
    valueType: 'number',
    category: 'booking_settings',
    displayName: 'Minimum Booking Buffer (minutes)',
    description: 'Earliest slot available from the current time',
  },
  {
    key: CONFIG_KEYS.APPOINTMENT_BUFFER_MINUTES,
    value: '5',
    valueType: 'number',
    category: 'booking_settings',
    displayName: 'Appointment Buffer (minutes)',
    description: 'Gap between consecutive bookings',
  },
  {
    key: CONFIG_KEYS.SLOT_INTERVAL_MINUTES,
    value: '15',
    valueType: 'number',
    category: 'booking_settings',
    displayName: 'Slot Interval (minutes)',
    description: 'Display interval for available slots',
  },
  {
    key: CONFIG_KEYS.BOOKING_AMOUNT,
    value: '10',
    valueType: 'number',
    category: 'booking_settings',
    displayName: 'Booking Amount (₹)',
    description: 'Fixed booking fee charged per appointment',
  },
  // Cancellation Settings
  {
    key: CONFIG_KEYS.FREE_CANCELLATION_WINDOW_MINUTES,
    value: '30',
    valueType: 'number',
    category: 'cancellation_settings',
    displayName: 'Free Cancellation Window (minutes)',
    description: 'Period within which cancellation is free with full refund',
  },
  {
    key: CONFIG_KEYS.LATE_CANCELLATION_FEE_PERCENT,
    value: '50',
    valueType: 'number',
    category: 'cancellation_settings',
    displayName: 'Late Cancellation Fee (%)',
    description: 'Percentage deducted for cancellations outside the free window',
  },
  // Abuse Limits
  {
    key: CONFIG_KEYS.USER_CANCEL_LIMIT_PER_WEEK,
    value: '5',
    valueType: 'number',
    category: 'abuse_limits',
    displayName: 'User Cancel Limit Per Week',
    description: 'Maximum cancellations allowed before the user is blocked',
  },
  {
    key: CONFIG_KEYS.USER_BLOCK_DURATION_HOURS,
    value: '24',
    valueType: 'number',
    category: 'abuse_limits',
    displayName: 'User Block Duration (hours)',
    description: 'Duration for which a user is blocked after exceeding the cancel limit',
  },
  {
    key: CONFIG_KEYS.VENDOR_CANCEL_WARNING_THRESHOLD_PERCENT,
    value: '10',
    valueType: 'number',
    category: 'abuse_limits',
    displayName: 'Vendor Cancel Warning Threshold (%)',
    description: 'Cancellation rate at which a vendor receives a warning',
  },
  {
    key: CONFIG_KEYS.VENDOR_CANCEL_REVIEW_THRESHOLD_PERCENT,
    value: '20',
    valueType: 'number',
    category: 'abuse_limits',
    displayName: 'Vendor Cancel Review Threshold (%)',
    description: 'Cancellation rate at which a vendor is placed under review',
  },
  // Search Settings
  {
    key: CONFIG_KEYS.SHOP_MAX_DISTANCE_METERS,
    value: '10000',
    valueType: 'number',
    category: 'search_settings',
    displayName: 'Nearby Shops Search Radius (meters)',
    description: 'Maximum radius for nearby shop search',
  },
  {
    key: CONFIG_KEYS.RECOMMENDED_SHOPS_MAX_DISTANCE_METERS,
    value: '20000',
    valueType: 'number',
    category: 'search_settings',
    displayName: 'Recommended Shops Search Radius (meters)',
    description: 'Maximum radius for recommended shop search',
  },
  // Barber Settings
  {
    key: CONFIG_KEYS.WALK_IN_FALLBACK_DURATION_MINUTES,
    value: '30',
    valueType: 'number',
    category: 'booking_settings',
    displayName: 'Walk-in Fallback Duration (minutes)',
    description: 'Default walk-in slot duration when no services are selected',
  },
  // Issue Settings
  {
    key: CONFIG_KEYS.ISSUE_MAX_DISTANCE_METERS,
    value: '500',
    valueType: 'number',
    category: 'issue_settings',
    displayName: 'Issue Proximity Limit (meters)',
    description: 'Maximum distance from shop allowed to raise an issue',
  },
  {
    key: CONFIG_KEYS.SHOP_CANCEL_WEEKLY_LIMIT,
    value: '5',
    valueType: 'number',
    category: 'abuse_limits',
    displayName: 'Shop Cancel Weekly Limit',
    description: 'Max weekly vendor-initiated cancellations per shop before vendor is flagged',
  },
];
