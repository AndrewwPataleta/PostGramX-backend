import { useCallback, useMemo, useState } from 'react';

export type TableSortDirection = 'asc' | 'desc';

export type TableSortConfig = {
  columnKey: string;
  direction: TableSortDirection;
};

export type SortableValue = string | number | boolean | Date | null | undefined;

export type TableSorters<T> = Record<string, (item: T) => SortableValue>;

type NormalizedValue = {
  value: number | string;
  isNumber: boolean;
  isEmpty: boolean;
};

const normalizeValue = (value: SortableValue): NormalizedValue => {
  if (value === null || value === undefined || value === '') {
    return { value: '', isNumber: false, isEmpty: true };
  }

  if (value instanceof Date) {
    return { value: value.getTime(), isNumber: true, isEmpty: false };
  }

  if (typeof value === 'number') {
    return { value, isNumber: true, isEmpty: false };
  }

  if (typeof value === 'boolean') {
    return { value: value ? 1 : 0, isNumber: true, isEmpty: false };
  }

  return {
    value: String(value).toLowerCase(),
    isNumber: false,
    isEmpty: false,
  };
};

export const useTableSorting = <T>(data: T[], sorters: TableSorters<T>) => {
  const [sortConfig, setSortConfig] = useState<TableSortConfig | null>(null);
  const collator = useMemo(
    () => new Intl.Collator('ru', { sensitivity: 'base', numeric: true }),
    [],
  );

  const sortedData = useMemo(() => {
    if (!sortConfig) {
      return data;
    }

    const sorter = sorters[sortConfig.columnKey];
    if (!sorter) {
      return data;
    }

    const cloned = [...data];

    cloned.sort((itemA, itemB) => {
      const normalizedA = normalizeValue(sorter(itemA));
      const normalizedB = normalizeValue(sorter(itemB));

      if (normalizedA.isEmpty && normalizedB.isEmpty) {
        return 0;
      }

      if (normalizedA.isEmpty) {
        return 1;
      }

      if (normalizedB.isEmpty) {
        return -1;
      }

      let comparison: number;
      if (normalizedA.isNumber && normalizedB.isNumber) {
        comparison =
          (normalizedA.value as number) - (normalizedB.value as number);
      } else {
        comparison = collator.compare(
          String(normalizedA.value),
          String(normalizedB.value),
        );
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return cloned;
  }, [collator, data, sortConfig, sorters]);

  const toggleSort = useCallback(
    (columnKey: string) => {
      if (!sorters[columnKey]) {
        return;
      }

      setSortConfig((current) => {
        if (current?.columnKey === columnKey) {
          return {
            columnKey,
            direction: current.direction === 'asc' ? 'desc' : 'asc',
          };
        }

        return { columnKey, direction: 'asc' };
      });
    },
    [sorters],
  );

  return { sortedData, sortConfig, toggleSort };
};
