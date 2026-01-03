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
  // Get current date/time in Pakistan timezone
  const pakistanTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
  
  // Create a new date with just the date components (no time)
  const today = new Date(
    pakistanTime.getFullYear(),
    pakistanTime.getMonth(),
    pakistanTime.getDate(),
    0, 0, 0, 0
  );
  
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







