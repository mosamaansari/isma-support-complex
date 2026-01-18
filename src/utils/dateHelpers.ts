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
 * Parse UTC ISO date string and extract date components without timezone conversion
 * This prevents date shifts when displaying dates from backend
 * Example: "2026-01-18T21:47:00.931Z" -> extracts 2026-01-18 regardless of timezone
 */
export const parseUTCDateString = (dateString: string | Date | null | undefined): Date | null => {
  if (!dateString) return null;
  
  if (dateString instanceof Date) {
    // If it's already a Date, extract UTC components and create local date
    const year = dateString.getUTCFullYear();
    const month = dateString.getUTCMonth();
    const day = dateString.getUTCDate();
    const hours = dateString.getUTCHours();
    const minutes = dateString.getUTCMinutes();
    const seconds = dateString.getUTCSeconds();
    const milliseconds = dateString.getUTCMilliseconds();
    return new Date(year, month, day, hours, minutes, seconds, milliseconds);
  }
  
  if (typeof dateString === 'string') {
    // Parse ISO string and extract UTC components
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    // Extract UTC components to avoid timezone conversion
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const seconds = date.getUTCSeconds();
    const milliseconds = date.getUTCMilliseconds();
    
    // Create local date using UTC components (preserves the actual date from backend)
    return new Date(year, month, day, hours, minutes, seconds, milliseconds);
  }
  
  return null;
};

/**
 * Format date from backend (UTC ISO string) to display string without timezone shift
 * Directly formats UTC components to ensure exact time from backend is displayed
 */
export const formatBackendDate = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return "";
  
  let year: number, month: number, day: number, hours: number, minutes: number;
  
  if (dateString instanceof Date) {
    year = dateString.getUTCFullYear();
    month = dateString.getUTCMonth();
    day = dateString.getUTCDate();
    hours = dateString.getUTCHours();
    minutes = dateString.getUTCMinutes();
  } else if (typeof dateString === 'string') {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    year = date.getUTCFullYear();
    month = date.getUTCMonth();
    day = date.getUTCDate();
    hours = date.getUTCHours();
    minutes = date.getUTCMinutes();
  } else {
    return "";
  }
  
  // Format date: "Jan 18, 2026"
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateStr = `${monthNames[month]} ${day}, ${year}`;
  
  // Format time: HH:MM AM/PM
  const isPM = hours >= 12;
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const hoursStr = String(displayHours).padStart(2, "0");
  const minutesStr = String(minutes).padStart(2, "0");
  const ampm = isPM ? "PM" : "AM";
  const timeStr = `${hoursStr}:${minutesStr} ${ampm}`;
  
  return `${dateStr} ${timeStr}`;
};

/**
 * Format date only (no time) from backend (UTC ISO string) without timezone shift
 */
export const formatBackendDateOnly = (dateString: string | Date | null | undefined): string => {
  const date = parseUTCDateString(dateString);
  if (!date) return "";
  
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Format date only (short format) from backend (UTC ISO string) without timezone shift
 */
export const formatBackendDateShort = (dateString: string | Date | null | undefined): string => {
  const date = parseUTCDateString(dateString);
  if (!date) return "";
  
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
};

/**
 * Format date with time (including seconds) from backend (UTC ISO string) without timezone shift
 * Directly formats UTC components to ensure exact time from backend is displayed
 */
export const formatBackendDateWithTime = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return "";
  
  let year: number, month: number, day: number, hours: number, minutes: number, seconds: number;
  
  if (dateString instanceof Date) {
    year = dateString.getUTCFullYear();
    month = dateString.getUTCMonth();
    day = dateString.getUTCDate();
    hours = dateString.getUTCHours();
    minutes = dateString.getUTCMinutes();
    seconds = dateString.getUTCSeconds();
  } else if (typeof dateString === 'string') {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    year = date.getUTCFullYear();
    month = date.getUTCMonth();
    day = date.getUTCDate();
    hours = date.getUTCHours();
    minutes = date.getUTCMinutes();
    seconds = date.getUTCSeconds();
  } else {
    return "";
  }
  
  // Format date: MM/DD/YYYY
  const monthStr = String(month + 1).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");
  const dateStr = `${monthStr}/${dayStr}/${year}`;
  
  // Format time: HH:MM:SS AM/PM
  const isPM = hours >= 12;
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const hoursStr = String(displayHours).padStart(2, "0");
  const minutesStr = String(minutes).padStart(2, "0");
  const secondsStr = String(seconds).padStart(2, "0");
  const ampm = isPM ? "PM" : "AM";
  const timeStr = `${hoursStr}:${minutesStr}:${secondsStr} ${ampm}`;
  
  return `${dateStr} ${timeStr}`;
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

