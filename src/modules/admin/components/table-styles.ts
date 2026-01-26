import type { CSSProperties } from 'react';

import './admin-access-interceptor';

export const pageWrapperStyle: CSSProperties = {
  maxWidth: '100%',
  margin: '0',
  padding: '0 16px 32px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

export const cardStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '14px',
  border: '1px solid #e5e7eb',
  padding: '0',
  boxShadow: '0 10px 24px rgba(98, 0, 238, 0.05)',
  display: 'flex',
  flexDirection: 'column',
};

export const cardContentStyle: CSSProperties = {
  padding: '16px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

export const headingStyle: CSSProperties = {
  fontSize: '20px',
  fontWeight: 600,
  color: '#1f2937',
  margin: 0,
};

export const subHeadingStyle: CSSProperties = {
  fontSize: '14px',
  color: '#4b5563',
  margin: '4px 0 0',
};

export const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
};

export const buttonStyle: CSSProperties = {
  border: 'none',
  borderRadius: '16px',
  padding: '10px 20px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#ffffff',
  background: '#E98A98',
  cursor: 'pointer',
};

export const secondaryButtonStyle: CSSProperties = {
  borderRadius: '16px',
  padding: '10px 20px',
  fontSize: '14px',
  fontWeight: 600,
  background: 'transparent',
  border: '1px solid #E98A98',
  color: '#E98A98',
  cursor: 'pointer',
};

export const tableWrapperStyle: CSSProperties = {
  overflowX: 'auto',
  padding: '0 16px 20px',
};

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
};

export const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px',
  background: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
  fontWeight: 600,
  whiteSpace: 'nowrap',
  maxWidth: '260px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

export const tdStyle: CSSProperties = {
  padding: '10px',
  borderBottom: '1px solid #f3f4f6',
  maxWidth: '260px',
  whiteSpace: 'normal',
  wordBreak: 'break-word',
  overflowWrap: 'anywhere',
};

export const tableCellContentStyle: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
  lineHeight: 1.4,
  maxHeight: '2.8em',
};

export const sortableHeaderButtonStyle: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  border: 'none',
  background: 'transparent',
  padding: '10px',
  margin: 0,
  font: 'inherit',
  fontWeight: 'inherit',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
};

export const sortableHeaderLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  flex: 1,
};

export const sortIndicatorStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  lineHeight: 1,
  fontSize: '10px',
  color: '#9ca3af',
  textTransform: 'none',
};

export const activeSortIndicatorStyle: CSSProperties = {
  color: '#374151',
};

export const filterInputStyle: CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  fontSize: '12px',
  outline: 'none',
  color: '#1f2937',
  backgroundColor: '#ffffff',
  boxSizing: 'border-box',
};

export const statsStyle: CSSProperties = {
  display: 'flex',
  gap: '16px',
  flexWrap: 'wrap',
  fontSize: '13px',
  color: '#4b5563',
};

export const checkboxInputStyle: CSSProperties = {
  width: '27px',
  height: '27px',
  borderRadius: '8px',
  border: '2px solid #E98A98',
  backgroundColor: '#ffffff',
  cursor: 'pointer',
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 12px rgba(233, 138, 152, 0.15)',
  transition: 'box-shadow 0.2s ease, transform 0.2s ease',
  appearance: 'none',
  WebkitAppearance: 'none',
};
