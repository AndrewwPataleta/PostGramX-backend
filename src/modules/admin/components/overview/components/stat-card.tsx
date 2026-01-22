import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { CollapsibleCard } from '../../collapsible-card';
import {
  dashboardCardBaseStyle,
  dashboardCardTitleStyle,
  dashboardCardValueStyle,
  dashboardSubtitleTextStyle,
} from './shared-styles';

type DashboardStatCardProps = {
  title: string;
  value?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
};

const breakdownListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  marginTop: '8px',
};

const breakdownItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '12px',
};

const breakdownLabelStyle: CSSProperties = {
  fontSize: '15px',
  fontWeight: 500,
  color: '#475569',
};

const breakdownValueStyle: CSSProperties = {
  fontSize: '18px',
  fontWeight: 600,
  color: '#111827',
};

const breakdownDividerStyle: CSSProperties = {
  height: '1px',
  background: '#E2E8F0',
  margin: '8px 0',
};

export const DashboardStatCard: React.FC<DashboardStatCardProps> = ({
  title,
  value,
  description,
  children,
}) => (
  <CollapsibleCard style={dashboardCardBaseStyle} collapsible={false}>
    <span style={dashboardCardTitleStyle}>{title}</span>
    {value ? <span style={dashboardCardValueStyle}>{value}</span> : null}
    {description ? (
      <span style={dashboardSubtitleTextStyle}>{description}</span>
    ) : null}
    {children}
  </CollapsibleCard>
);

type PlatformBreakdownListProps = {
  breakdown: Record<string, number>;
  total?: number;
  labels?: Record<string, string>;
};

export const PlatformBreakdownList: React.FC<PlatformBreakdownListProps> = ({
  breakdown,
  total,
  labels = {},
}) => {
  const entries = Object.entries(breakdown);
  const totalValue = total ?? entries.reduce((sum, [, value]) => sum + value, 0);

  return (
    <div style={breakdownListStyle}>
      {entries.map(([key, value], index) => (
        <React.Fragment key={key}>
          <div style={breakdownItemStyle}>
            <span style={breakdownLabelStyle}>{labels[key] ?? key}</span>
            <span style={breakdownValueStyle}>{value.toLocaleString()}</span>
          </div>
          {index < entries.length - 1 ? (
            <div style={breakdownDividerStyle} />
          ) : null}
        </React.Fragment>
      ))}
      {typeof totalValue === 'number' ? (
        <div style={{ ...breakdownItemStyle, marginTop: '4px' }}>
          <span style={{ ...breakdownLabelStyle, fontWeight: 600 }}>Total</span>
          <span style={{ ...breakdownValueStyle, fontWeight: 700 }}>
            {totalValue.toLocaleString()}
          </span>
        </div>
      ) : null}
    </div>
  );
};
