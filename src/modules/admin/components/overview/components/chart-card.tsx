import React from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { CollapsibleCard } from '../../collapsible-card';
import {
  chartRangeTextStyle,
  dashboardCardBaseStyle,
  dashboardCardTitleStyle,
} from './shared-styles';

type DashboardChartCardProps = {
  title: string;
  rangeText?: string | null;
  children: ReactNode;
};

const chartCardStyle: CSSProperties = {
  ...dashboardCardBaseStyle,
  minHeight: '320px',
  gap: '16px',
};

export const DashboardChartCard: React.FC<DashboardChartCardProps> = ({
  title,
  rangeText,
  children,
}) => (
  <CollapsibleCard style={chartCardStyle} collapsible={false}>
    <span style={dashboardCardTitleStyle}>{title}</span>
    {rangeText ? <span style={chartRangeTextStyle}>{rangeText}</span> : null}
    {children}
  </CollapsibleCard>
);
