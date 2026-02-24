/** Timezone-aware date utilities — formats dates as MM/dd/yyyy and computes year/month time windows. */

export const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Format date as MM/dd/yyyy in specified timezone
 * Handles both ISO strings and milliseconds
 */
export function fmtDateMDY(
  isoStringOrMs: string | number | null | undefined,
  timezone: string = DEFAULT_TIMEZONE
): string {
  if (isoStringOrMs === null || isoStringOrMs === undefined || isoStringOrMs === '') {
    return '';
  }

  const d = typeof isoStringOrMs === 'number'
    ? new Date(isoStringOrMs)
    : new Date(isoStringOrMs);

  // Format as MM/dd/yyyy
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const year = d.getUTCFullYear();

  return `${month}/${day}/${year}`;
}

export interface TimeWindow {
  startMs: number;
  endMs: number;
}

/**
 * Get year boundaries in local timezone as milliseconds
 * Example: yearWindowLocalMs(2024) returns Jan 1 2024 00:00 to Jan 1 2025 00:00
 */
export function yearWindowLocalMs(year: number): TimeWindow {
  const start = new Date(year, 0, 1, 0, 0, 0);      // Jan 1, 00:00 local
  const end = new Date(year + 1, 0, 1, 0, 0, 0);    // Jan 1 next year, 00:00 local

  return {
    startMs: start.getTime(),
    endMs: end.getTime()
  };
}

/**
 * Get month boundaries in local timezone as milliseconds
 * Example: monthWindowLocalMs(2024, 3) returns March 1-31, 2024
 */
export function monthWindowLocalMs(year: number, month1to12: number): TimeWindow {
  const start = new Date(year, month1to12 - 1, 1, 0, 0, 0);
  const end = new Date(year, month1to12, 1, 0, 0, 0);

  return {
    startMs: start.getTime(),
    endMs: end.getTime()
  };
}