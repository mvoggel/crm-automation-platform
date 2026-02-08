import { fmtDateMDY, yearWindowLocalMs, monthWindowLocalMs } from './date';

describe('Date Utilities', () => {
  describe('fmtDateMDY', () => {
    it('formats ISO date string to MM/dd/yyyy', () => {
      expect(fmtDateMDY('2024-03-15T10:30:00Z')).toBe('03/15/2024');
    });

    it('formats milliseconds to MM/dd/yyyy', () => {
      const ms = new Date('2024-03-15T10:30:00Z').getTime();
      expect(fmtDateMDY(ms)).toBe('03/15/2024');
    });

    it('handles null input', () => {
      expect(fmtDateMDY(null)).toBe('');
    });

    it('handles undefined input', () => {
      expect(fmtDateMDY(undefined)).toBe('');
    });

    it('handles empty string', () => {
      expect(fmtDateMDY('')).toBe('');
    });

    it('pads single-digit months and days', () => {
      expect(fmtDateMDY('2024-01-05T00:00:00Z')).toBe('01/05/2024');
    });
  });

  describe('yearWindowLocalMs', () => {
    it('returns correct year boundaries', () => {
      const { startMs, endMs } = yearWindowLocalMs(2024);

      const start = new Date(startMs);
      const end = new Date(endMs);

      expect(start.getFullYear()).toBe(2024);
      expect(start.getMonth()).toBe(0); // January
      expect(start.getDate()).toBe(1);

      expect(end.getFullYear()).toBe(2025);
      expect(end.getMonth()).toBe(0); // January
      expect(end.getDate()).toBe(1);
    });

    it('returns 365 days for non-leap year', () => {
      const { startMs, endMs } = yearWindowLocalMs(2023);
      const days = (endMs - startMs) / (1000 * 60 * 60 * 24);
      expect(days).toBe(365);
    });

    it('returns 366 days for leap year', () => {
      const { startMs, endMs } = yearWindowLocalMs(2024);
      const days = (endMs - startMs) / (1000 * 60 * 60 * 24);
      expect(days).toBe(366);
    });
  });

  describe('monthWindowLocalMs', () => {
    it('returns correct month boundaries for March', () => {
      const { startMs, endMs } = monthWindowLocalMs(2024, 3);

      const start = new Date(startMs);
      const end = new Date(endMs);

      expect(start.getMonth()).toBe(2); // March (0-indexed)
      expect(start.getDate()).toBe(1);

      expect(end.getMonth()).toBe(3); // April
      expect(end.getDate()).toBe(1);
    });

    it('returns 31 days for January', () => {
      const { startMs, endMs } = monthWindowLocalMs(2024, 1);
      const days = (endMs - startMs) / (1000 * 60 * 60 * 24);
      expect(days).toBe(31);
    });

    it('returns 29 days for February 2024 (leap year)', () => {
      const { startMs, endMs } = monthWindowLocalMs(2024, 2);
      const days = (endMs - startMs) / (1000 * 60 * 60 * 24);
      expect(days).toBe(29);
    });

    it('returns 28 days for February 2023 (non-leap year)', () => {
      const { startMs, endMs } = monthWindowLocalMs(2023, 2);
      const days = (endMs - startMs) / (1000 * 60 * 60 * 24);
      expect(days).toBe(28);
    });
  });
});