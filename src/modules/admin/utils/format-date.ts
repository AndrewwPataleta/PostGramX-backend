const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export const formatDisplayDate = (
  value: string | number | Date | null | undefined,
): string => {
  if (value === null || value === undefined) {
    return '—';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return DISPLAY_DATE_FORMATTER.format(date);
};
