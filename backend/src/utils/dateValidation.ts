/**
 * Validates that a given date is today's date
 * @param dateInput - Date string or Date object to validate
 * @returns true if the date is today, false otherwise
 */
export const isTodayDate = (dateInput: string | Date | undefined): boolean => {
  if (!dateInput) {
    return true; // If no date provided, it will default to today in the service
  }

  const inputDate = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const today = new Date();

  // Compare year, month, and day only (ignore time)
  return (
    inputDate.getFullYear() === today.getFullYear() &&
    inputDate.getMonth() === today.getMonth() &&
    inputDate.getDate() === today.getDate()
  );
};

/**
 * Validates that a date is today and throws an error if not
 * @param dateInput - Date string or Date object to validate
 * @param fieldName - Name of the field for error message
 * @throws Error if date is not today
 */
export const validateTodayDate = (dateInput: string | Date | undefined, fieldName: string = 'date'): void => {
  if (dateInput && !isTodayDate(dateInput)) {
    throw new Error(`Invalid ${fieldName}: Only today's date is allowed. Please refresh and try again.`);
  }
};

/**
 * Gets today's date at start of day (00:00:00)
 */
export const getTodayStart = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/**
 * Gets today's date at end of day (23:59:59)
 */
export const getTodayEnd = (): Date => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
};




