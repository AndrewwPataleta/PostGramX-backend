import React, { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

import { filterInputStyle } from './table-styles';

const paginationWrapperStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '12px 16px 20px',
  borderTop: '1px solid #f3f4f6',
  fontSize: '13px',
  color: '#4b5563',
};

const paginationInfoStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const paginationControlsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  alignItems: 'center',
};

const paginationButtonsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const paginationButtonStyle: CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  padding: '6px 12px',
  background: '#ffffff',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  color: '#1f2937',
  transition: 'opacity 0.2s ease',
};

const pageIndicatorStyle: CSSProperties = {
  minWidth: '70px',
  textAlign: 'center',
  fontWeight: 600,
};

const paginationSelectStyle: CSSProperties = {
  ...filterInputStyle,
  width: '120px',
};

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100];
const numberFormatter = new Intl.NumberFormat('ru-RU');

export type UseTablePaginationOptions = {
  initialPageSize?: number;
};

export const useTablePagination = <T,>(
  data: T[],
  options?: UseTablePaginationOptions,
) => {
  const [pageSize, setPageSize] = useState(options?.initialPageSize ?? 5);
  const [currentPage, setCurrentPage] = useState(1);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, totalItems]);

  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = totalItems === 0 ? 0 : Math.min(startIndex + pageSize, totalItems);

  const paginatedData = useMemo(() => {
    if (!data.length) {
      return [] as T[];
    }
    return data.slice(startIndex, startIndex + pageSize);
  }, [data, pageSize, startIndex]);

  return {
    currentPage,
    pageSize,
    totalPages,
    paginatedData,
    startIndex,
    endIndex,
    totalItems,
    setCurrentPage,
    setPageSize,
  } as const;
};

export type TablePaginationProps = {
  totalItems: number;
  startIndex: number;
  endIndex: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  pageSizeLabel?: string;
};

export const TablePagination: React.FC<TablePaginationProps> = ({
  totalItems,
  startIndex,
  endIndex,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  pageSizeLabel = 'Per page',
}) => {
  const canGoBack = currentPage > 1;
  const canGoForward = currentPage < totalPages;
  const displayFrom = totalItems === 0 ? 0 : startIndex + 1;
  const displayTo = totalItems === 0 ? 0 : endIndex;

  return (
    <div style={paginationWrapperStyle}>
      <div style={paginationInfoStyle}>
        <span>
          Showing {numberFormatter.format(displayFrom)}–{numberFormatter.format(displayTo)} of{' '}
          {numberFormatter.format(totalItems)}
        </span>
      </div>
      <div style={paginationControlsStyle}>
        <label style={labelStyle}>
          <span>{pageSizeLabel}</span>
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            style={paginationSelectStyle}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option} / page
              </option>
            ))}
          </select>
        </label>
        <div style={paginationButtonsStyle}>
          <button
            type="button"
            style={{
              ...paginationButtonStyle,
              opacity: canGoBack ? 1 : 0.4,
              cursor: canGoBack ? 'pointer' : 'not-allowed',
            }}
            onClick={() => canGoBack && onPageChange(currentPage - 1)}
            disabled={!canGoBack}
          >
            Back
          </button>
          <span style={pageIndicatorStyle}>
            {numberFormatter.format(currentPage)} / {numberFormatter.format(totalPages)}
          </span>
          <button
            type="button"
            style={{
              ...paginationButtonStyle,
              opacity: canGoForward ? 1 : 0.4,
              cursor: canGoForward ? 'pointer' : 'not-allowed',
            }}
            onClick={() => canGoForward && onPageChange(currentPage + 1)}
            disabled={!canGoForward}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
