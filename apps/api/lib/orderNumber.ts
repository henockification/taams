import { customAlphabet } from 'nanoid';

/**
 * Generates a dynamic, scalable order number.
 * Format: ORD-YYYYMMDD-[RANDOM_STRING]
 * Example: ORD-20260321-X9K2L4
 */
export const generateOrderNumber = (prefix: string = 'ORD'): string => {
  // 1. Generate Date String (YYYYMMDD)
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // 2. Generate Random Suffix
  // We exclude confusing characters like 0, O, I, 1, L
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nanoid = customAlphabet(alphabet, 6);
  const randomStr = nanoid();

  return `${prefix}-${dateStr}-${randomStr}`;
};