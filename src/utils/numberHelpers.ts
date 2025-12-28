/**
 * Limits decimal places to 2 digits
 * @param value - The number or string to format
 * @returns Formatted number with max 2 decimal places
 */
export const limitDecimalPlaces = (value: number | string): number => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 0;
  return Math.round(num * 100) / 100;
};

/**
 * Formats a number to string with exactly 2 decimal places
 * @param value - The number to format
 * @returns Formatted string with 2 decimal places
 */
export const formatDecimal = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  return limitDecimalPlaces(num).toFixed(2);
};

/**
 * Handles decimal input change event and limits to 2 decimal places
 * @param value - Input value from event
 * @returns Limited decimal number or undefined if empty
 */
export const handleDecimalInput = (value: string): number | undefined => {
  if (value === '' || value === null || value === undefined) return undefined;
  const num = parseFloat(value);
  if (isNaN(num)) return undefined;
  return limitDecimalPlaces(num);
};

/**
 * Validates and restricts input to 2 decimal places in real-time
 * @param event - Input event
 */
export const restrictDecimalInput = (event: React.FormEvent<HTMLInputElement>) => {
  const input = event.currentTarget;
  const value = input.value;
  
  // Allow empty value
  if (value === '') return;
  
  // Check if value has more than 2 decimal places
  const parts = value.split('.');
  if (parts.length === 2 && parts[1].length > 2) {
    // Truncate to 2 decimal places
    input.value = `${parts[0]}.${parts[1].substring(0, 2)}`;
  }
};

