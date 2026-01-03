/**
 * Get today's date in YYYY-MM-DD format (local timezone, no UTC conversion)
 */
export const getTodayDate = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Format a Date object to YYYY-MM-DD format (local timezone)
 */
export const formatDateToString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Convert date string (YYYY-MM-DD) or Date to Date object for local date calculations
 */
export const getLocalDate = (dateInput: string | Date): Date => {
  if (dateInput instanceof Date) {
    return new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate());
  }
  // If it's a string in YYYY-MM-DD format
  const parts = dateInput.split("T")[0].split("-");
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
};

/**
 * Format a Date object to ISO-like string but in local timezone (not UTC)
 * This prevents timezone shifts when storing dates
 */
export const formatDateToLocalISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
};

/**
 * Get date range for reports
 */
export const getDateRangeFromType = (reportType: "daily" | "weekly" | "monthly" | "custom", startDate?: string, endDate?: string) => {
  const today = new Date();
  let start: Date, end: Date;

  switch (reportType) {
    case "daily": {
      const baseDate = startDate ? getLocalDate(startDate) : today;
      start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      end = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      break;
    }
    case "weekly": {
      const baseDate = startDate ? getLocalDate(startDate) : today;
      // Weekly: 7 days ending on the base date (6 days before + base date = 7 days)
      start = new Date(baseDate);
      start.setDate(baseDate.getDate() - 6); // 6 days before + today = 7 days total
      start = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      end = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
      break;
    }
    case "monthly": {
      const baseDate = startDate ? getLocalDate(startDate) : today;
      start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
      break;
    }
    default:
      if (!startDate || !endDate) return null;
      start = getLocalDate(startDate);
      end = getLocalDate(endDate);
      break;
  }

  return {
    start: formatDateToString(start),
    end: formatDateToString(end),
  };
};

