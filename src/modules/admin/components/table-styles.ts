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
  margin: 0,
};
