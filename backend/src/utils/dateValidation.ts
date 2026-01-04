/**
 * Validates that a given date is today's date (in Pakistan timezone)
 * @param dateInput - Date string or Date object to validate
 * @returns true if the date is today, false otherwise
 */
export const isTodayDate = (dateInput: string | Date | undefined): boolean => {
  if (!dateInput) {
    return true; // If no date provided, it will default to today in the service
  }

  // Parse input date - handle UTC ISO strings
  let inputDate: Date;
  if (typeof dateInput === 'string') {
    // If it's a UTC ISO string (ends with Z), parse it properly
    if (dateInput.endsWith('Z')) {
      const date = new Date(dateInput);
      // Extract UTC date components to avoid timezone shift
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      // Create local date using UTC components (represents actual date in Pakistan)
      inputDate = new Date(year, month, day, 12, 0, 0, 0);
    } else {
      inputDate = new Date(dateInput);
    }
  } else {
    inputDate = dateInput;
  }

  // Get today's date in Pakistan timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const parts = formatter.formatToParts(now);
  const todayYear = parseInt(parts.find(p => p.type === "year")?.value || "0", 10);
  const todayMonth = parseInt(parts.find(p => p.type === "month")?.value || "0", 10) - 1; // Month is 0-indexed
  const todayDay = parseInt(parts.find(p => p.type === "day")?.value || "0", 10);
  const today = new Date(todayYear, todayMonth, todayDay, 12, 0, 0, 0);

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




