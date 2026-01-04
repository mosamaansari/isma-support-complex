/**
 * Date helpers that are consistent with frontend `getTodayDate()`:
 * - Use LOCAL timezone (not UTC)
 * - Work with YYYY-MM-DD strings safely (no Date("YYYY-MM-DD") parsing quirks)
 */

export function formatLocalYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseLocalYMD(dateStr: string): Date {
  const [y, m, d] = dateStr.split("T")[0].split("-").map((v) => parseInt(v, 10));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/**
 * Parse a date string that was stored in local ISO format (without timezone conversion)
 * This handles dates like "2026-01-02T19:23:51.614Z" where the Z is just a format marker,
 * not an actual UTC timezone indicator. The date should be treated as local time.
 */
export function parseLocalISO(dateStr: string): Date {
  // Remove the 'Z' suffix if present (it's just a format marker, not UTC)
  const cleanDateStr = dateStr.replace(/Z$/, '');
  
  // Parse the date components
  const match = cleanDateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  
  if (match) {
    const [, year, month, day, hour, minute, second, millisecond] = match;
    return new Date(
      parseInt(year),
      parseInt(month) - 1, // Month is 0-indexed
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second),
      millisecond ? parseInt(millisecond.padEnd(3, '0').substring(0, 3)) : 0
    );
  }
  
  // Fallback to standard parsing if format doesn't match
  return new Date(dateStr);
}

/**
 * Get today's date in Pakistan timezone (Asia/Karachi)
 * Returns a Date object with time set to 00:00:00 in Pakistan timezone
 */
export function getTodayInPakistan(): Date {
  const now = new Date();
  
  // Get date components directly from Pakistan timezone using Intl.DateTimeFormat
  // This avoids timezone conversion issues
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  
  // Format the date to get components
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === "year")?.value || "0", 10);
  const month = parseInt(parts.find(p => p.type === "month")?.value || "0", 10) - 1; // Month is 0-indexed
  const day = parseInt(parts.find(p => p.type === "day")?.value || "0", 10);
  
  // Create a date using local date components (not UTC)
  // This ensures the date represents the Pakistan date without timezone conversion
  const today = new Date(year, month, day, 0, 0, 0, 0);
  console.log("today", today);
  return today;
}

/**
 * Get current date and time in local timezone (Pakistan)
 * Returns a Date object with current local date and time (no UTC conversion)
 */
export function getCurrentLocalDateTime(): Date {
  const now = new Date();
  // Get current date/time components in local timezone
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const milliseconds = now.getMilliseconds();
  
  // Create a new date using local components (this avoids UTC conversion)
  return new Date(year, month, day, hours, minutes, seconds, milliseconds);
}

/**
 * Format a Date object to local ISO string without UTC conversion
 * Similar to frontend formatDateToLocalISO function
 * Note: Does NOT add "Z" suffix to avoid UTC interpretation
 */
export function formatDateToLocalISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
  // Do NOT add "Z" suffix - it causes UTC interpretation
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}







