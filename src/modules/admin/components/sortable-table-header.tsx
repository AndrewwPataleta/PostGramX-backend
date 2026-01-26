import React from 'react';

import type { CSSProperties, ReactNode } from 'react';

import {
  activeSortIndicatorStyle,
  sortIndicatorStyle,
  sortableHeaderButtonStyle,
  sortableHeaderLabelStyle,
  thStyle,
} from './table-styles';
import type { TableSortConfig } from './use-table-sorting';

type SortableTableHeaderProps = {
  columnKey: string;
  label: ReactNode;
  sortConfig: TableSortConfig | null;
  onSort: (columnKey: string) => void;
  align?: 'left' | 'center' | 'right';
  style?: CSSProperties;
  ariaLabel?: string;
};

const arrowStyle: CSSProperties = {
  fontSize: '10px',
  lineHeight: 1,
};

export const SortableTableHeader: React.FC<SortableTableHeaderProps> = ({
  columnKey,
  label,
  sortConfig,
  onSort,
  align = 'left',
  style,
  ariaLabel,
}) => {
  const isActive = sortConfig?.columnKey === columnKey;
  const direction = sortConfig?.direction;
  const resolvedAriaLabel =
    ariaLabel ??
    (typeof label === 'string'
      ? `Sort by column “${label}”`
      : undefined);

  return (
    <th
      style={{ ...thStyle, padding: 0, ...style }}
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        style={sortableHeaderButtonStyle}
        onClick={() => onSort(columnKey)}
        aria-label={resolvedAriaLabel}
      >
        <span style={{ ...sortableHeaderLabelStyle, textAlign: align }}>
          {label}
        </span>
        <span
          style={{
            ...sortIndicatorStyle,
            ...(isActive ? activeSortIndicatorStyle : {}),
          }}
          aria-hidden
        >
          <span style={{ ...arrowStyle, opacity: !isActive || direction === 'asc' ? 1 : 0.3 }}>
            ▲
          </span>
          <span style={{ ...arrowStyle, opacity: !isActive || direction === 'desc' ? 1 : 0.3 }}>
            ▼
          </span>
        </span>
      </button>
    </th>
  );
};

export default SortableTableHeader;
