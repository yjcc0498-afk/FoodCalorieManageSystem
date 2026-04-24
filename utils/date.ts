const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

const parseDateKey = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value.trim())) {
    return null;
  }

  const normalizedValue = value.trim();
  const parsedDate = new Date(`${normalizedValue}T00:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
};

const parseMonthKey = (value: unknown): { year: number; month: number } | null => {
  if (typeof value !== 'string' || !MONTH_PATTERN.test(value.trim())) {
    return null;
  }

  const [yearText, monthText] = value.trim().split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return { year, month };
};

const formatDateKey = (value: Date | string | number): string => {
  const date = value instanceof Date ? value : new Date(value);

  return date.toISOString().slice(0, 10);
};

const getUtcDayRange = (value: Date) => {
  const start = new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
    0,
    0,
    0,
    0
  ));
  const end = new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate() + 1,
    0,
    0,
    0,
    0
  ));

  return {
    start,
    end
  };
};

const getUtcMonthRange = (year: number, month: number) => {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

  return {
    start,
    end
  };
};

const getTodayDateKey = () => formatDateKey(new Date());

export {
  parseDateKey,
  parseMonthKey,
  formatDateKey,
  getUtcDayRange,
  getUtcMonthRange,
  getTodayDateKey
};
