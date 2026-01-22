import type { CSSProperties } from 'react';

export const dashboardCardBaseStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '16px',
  padding: '24px',
  boxShadow: '0 12px 28px rgba(98, 0, 238, 0.12)',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  minHeight: '140px',
  justifyContent: 'space-between',
};

export const dashboardCardTitleStyle: CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#000000',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '12px',
};

export const dashboardCardValueStyle: CSSProperties = {
  fontSize: '32px',
  fontWeight: 700,
  color: '#1C1C38',
  marginBottom: '6px',
};

export const dashboardSubtitleTextStyle: CSSProperties = {
  fontSize: '16px',
  color: '#6B7280',
};

export const chartRangeTextStyle: CSSProperties = {
  fontSize: '14px',
  color: '#6B7280',
};
