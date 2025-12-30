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






