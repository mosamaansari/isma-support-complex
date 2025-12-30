/**
 * Number helper utilities for backend
 * Ensures all decimal values are limited to 2 decimal places
 */

/**
 * Limits decimal places to 2 digits
 * @param value - The number to format
 * @returns Number rounded to 2 decimal places
 */
export const limitDecimalPlaces = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
};

/**
 * Formats a number to exactly 2 decimal places
 * @param value - The number to format
 * @returns Formatted number with 2 decimal places
 */
export const formatDecimal = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  return limitDecimalPlaces(num).toFixed(2);
};

/**
 * Rounds an object's numeric properties to 2 decimal places
 * @param obj - Object with numeric properties
 * @param fields - Array of field names to round
 * @returns Object with rounded values
 */
export const roundObjectDecimals = <T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T => {
  const rounded = { ...obj };
  fields.forEach((field) => {
    if (typeof rounded[field] === 'number') {
      rounded[field] = limitDecimalPlaces(rounded[field]) as any;
    }
  });
  return rounded;
};



