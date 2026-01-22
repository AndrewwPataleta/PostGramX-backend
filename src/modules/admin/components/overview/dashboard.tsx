import React from 'react';
import type {
  AdminJSGlobalBase,
  AdminJSApiClientBase,
} from '../adminjs-global';
import {
  DashboardStatCard,
  PlatformBreakdownList,
} from './components/stat-card';
import { DashboardChartCard } from './components/chart-card';
import { dashboardSubtitleTextStyle } from './components/shared-styles';

type PlatformBreakdown = {
  android: number;
  ios: number;
  telegram: number;
  other: number;
};

type PlatformTimeSeriesPoint = {
  day: string;
  breakdown: PlatformBreakdown;
};

type CountTimeSeriesPoint = {
  day: string;
  value: number;
};

type DashboardResponse = {
  totalUsers: number;
  platformBreakdown: PlatformBreakdown;
  totalWishItems: number;
  shareProfileClicks: number;
  wishItemsByPlatform: PlatformBreakdown;
  totalPartners: number;
  totalSurveys: number;
  completedSurveys: number;
  onboarding: {
    total: number;
    byPlatform: PlatformBreakdown;
  };
  lastLogin: {
    today: number;
  };
  charts: {
    range: {
      days: number;
      start: string;
      end: string;
    };
    userGrowth: PlatformTimeSeriesPoint[];
    wishGrowth: PlatformTimeSeriesPoint[];
    surveyCompletion: CountTimeSeriesPoint[];
  };
  presentation?: {
    enabled: boolean;
  };
};

type DashboardState = {
  data: DashboardResponse | null;
  loading: boolean;
  error: string | null;
};

type AdminJSApiClient = AdminJSApiClientBase & {
  getDashboard: () => Promise<{ data?: DashboardResponse | null }>;
};

type AdminJSGlobal = AdminJSGlobalBase<AdminJSApiClient>;

type PresentationMode = 'real' | 'mock';

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
  padding: '16px',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '20px',
};

const chartSectionStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '20px',
};

const progressContainerStyle: React.CSSProperties = {
  width: '100%',
  height: '8px',
  background: '#EDE9FE',
  borderRadius: '999px',
  overflow: 'hidden',
  marginTop: '12px',
};

const progressBarStyle = (value: number): React.CSSProperties => ({
  width: `${Math.max(0, Math.min(100, value))}%`,
  height: '100%',
  background: 'linear-gradient(90deg, #7F39FB 0%, #03DAC6 100%)',
});

const titleStyle: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 700,
  color: '#4B5563',
};

const subtitleStyle = dashboardSubtitleTextStyle;

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  marginTop: '16px',
};

const ctaButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '16px',
  padding: '12px 24px',
  fontSize: '15px',
  fontWeight: 600,
  color: '#ffffff',
  background: '#E98A98',
  textDecoration: 'none',
  boxShadow: '0 10px 24px rgba(98, 0, 238, 0.24)',
};

const pageHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  marginBottom: '32px',
};

const pageIntroTextStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  maxWidth: '720px',
};

const pageSubtitleStandaloneStyle: React.CSSProperties = {
  ...subtitleStyle,
  lineHeight: 1.6,
};

const presentationToggleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 14px',
  borderRadius: '14px',
  background: '#FDF2F8',
  border: '1px solid #FBCFE8',
  color: '#7C3AED',
  fontWeight: 600,
  fontSize: '13px',
};

const presentationButtonStyle: React.CSSProperties = {
  borderRadius: '999px',
  border: '1px solid #FBCFE8',
  padding: '6px 14px',
  background: '#FFFFFF',
  color: '#7C3AED',
  fontWeight: 600,
  fontSize: '12px',
  cursor: 'pointer',
};

const presentationButtonActiveStyle: React.CSSProperties = {
  background: '#EC4899',
  borderColor: '#EC4899',
  color: '#FFFFFF',
};

const errorStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: '12px',
  background: '#FEE2E2',
  color: '#991B1B',
  fontWeight: 500,
};

const loadingStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: '12px',
  background: '#E0E7FF',
  color: '#312E81',
  fontWeight: 500,
};

const chartLegendContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  alignItems: 'center',
};

const chartLegendItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
  color: '#374151',
};

const chartLegendMarkerStyle: React.CSSProperties = {
  width: '12px',
  height: '12px',
  borderRadius: '999px',
  display: 'inline-block',
};

const chartFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '13px',
  color: '#6B7280',
};

const emptyStateStyle: React.CSSProperties = {
  padding: '16px',
  borderRadius: '12px',
  background: '#F3F4F6',
  color: '#4B5563',
  fontWeight: 500,
  textAlign: 'center',
};

const chartPinkPalette = {
  primary: '#E98A98',
  accent: '#F08BA2',
  soft: '#F6BCC7',
  bold: '#D96682',
  highlight: '#F4A6B7',
};

const PRESENTATION_STORAGE_KEY = 'postgramx-admin-dashboard-presentation';

const formatNumber = (
  value: number,
  options?: Intl.NumberFormatOptions,
) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    ...options,
  }).format(value);

const chartDateFormatter = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
});

const formatDayLabel = (day: string) => {
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? day : chartDateFormatter.format(date);
};

const buildPresentationDateKeys = (days: number) => {
  const normalizedDays = Math.max(1, days);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (normalizedDays - 1));

  return Array.from({ length: normalizedDays }, (_, index) => {
    const date = new Date(start.getTime());
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
};

const buildMockPlatformSeries = (
  labels: string[],
  base: PlatformBreakdown,
  increment: PlatformBreakdown,
): PlatformTimeSeriesPoint[] =>
  labels.map((day, index) => ({
    day,
    breakdown: {
      android: base.android + increment.android * index,
      ios: base.ios + increment.ios * index,
      telegram: base.telegram + increment.telegram * index,
      other: base.other + increment.other * index,
    },
  }));

const buildMockCountSeries = (
  labels: string[],
  base: number,
  increment: number,
): CountTimeSeriesPoint[] =>
  labels.map((day, index) => ({
    day,
    value: base + increment * index,
  }));

const buildMockDashboardData = (days: number): DashboardResponse => {
  const labels = buildPresentationDateKeys(days);
  const totalUsers = 12480;
  const platformBreakdown = {
    android: 5520,
    ios: 4280,
    telegram: 2350,
    other: 330,
  };
  const totalWishItems = 58640;
  const shareProfileClicks = 8120;
  const totalPartners = 48;
  const totalSurveys = 3260;
  const completedSurveys = 2975;
  const onboardingTotal = 10320;

  return {
    totalUsers,
    platformBreakdown,
    totalWishItems,
    shareProfileClicks,
    wishItemsByPlatform: {
      android: 24800,
      ios: 21200,
      telegram: 10800,
      other: 1840,
    },
    totalPartners,
    totalSurveys,
    completedSurveys,
    onboarding: {
      total: onboardingTotal,
      byPlatform: {
        android: 4580,
        ios: 3740,
        telegram: 1800,
        other: 200,
      },
    },
    lastLogin: {
      today: 1430,
    },
    charts: {
      range: {
        days: labels.length,
        start: labels[0],
        end: labels[labels.length - 1],
      },
      userGrowth: buildMockPlatformSeries(
        labels,
        { android: 180, ios: 130, telegram: 80, other: 20 },
        { android: 24, ios: 18, telegram: 10, other: 2 },
      ),
      wishGrowth: buildMockPlatformSeries(
        labels,
        { android: 320, ios: 280, telegram: 160, other: 40 },
        { android: 36, ios: 32, telegram: 18, other: 6 },
      ),
      surveyCompletion: buildMockCountSeries(labels, 40, 6),
    },
    presentation: {
      enabled: true,
    },
  };
};

type LineChartSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

type LineChartProps = {
  labels: string[];
  series: LineChartSeries[];
  height?: number;
  emptyMessage?: string;
};

const LineChart: React.FC<LineChartProps> = ({
  labels,
  series,
  height = 180,
  emptyMessage = 'No data to display.',
}) => {
  const validSeries = React.useMemo(
    () => series.filter((serie) => serie.values.length === labels.length),
    [series, labels.length],
  );

  if (!labels.length || !validSeries.length) {
    return <div style={emptyStateStyle}>{emptyMessage}</div>;
  }

  const maxValue = Math.max(
    ...validSeries.flatMap((serie) => serie.values),
    1,
  );

  const normalizedSeries = validSeries.map((serie) => ({
    ...serie,
    normalized: serie.values.map((value) => value / maxValue),
  }));

  const columns = labels.length;
  const columnWidth = 100 / columns;

  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          alignItems: 'end',
          gap: '6px',
          height: `${height}px`,
        }}
      >
        {labels.map((label, index) => (
          <div
            key={label}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
            }}
          >
            {normalizedSeries.map((serie) => {
              const barHeight = Math.max(8, serie.normalized[index] * height);
              return (
                <div
                  key={serie.key}
                  style={{
                    width: `${columnWidth * 0.6}%`,
                    height: `${barHeight}px`,
                    background: serie.color,
                    borderRadius: '999px',
                    marginBottom: '6px',
                    transition: 'height 0.2s ease',
                  }}
                />
              );
            })}
            <span style={{ fontSize: '11px', color: '#6B7280' }}>
              {formatDayLabel(label)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const buildDashboardChartRangeText = (data: DashboardResponse) => {
  if (!data.charts.range.start || !data.charts.range.end) {
    return null;
  }
  return `${formatDayLabel(data.charts.range.start)} → ${formatDayLabel(
    data.charts.range.end,
  )}`;
};

const buildPlatformChartSeries = (
  data: PlatformTimeSeriesPoint[],
  labels: string[],
) => {
  const baseSeries: LineChartSeries[] = [
    {
      key: 'android',
      label: 'Android',
      color: chartPinkPalette.primary,
      values: [],
    },
    {
      key: 'ios',
      label: 'iOS',
      color: chartPinkPalette.bold,
      values: [],
    },
    {
      key: 'telegram',
      label: 'Telegram',
      color: chartPinkPalette.accent,
      values: [],
    },
    {
      key: 'other',
      label: 'Other',
      color: chartPinkPalette.soft,
      values: [],
    },
  ];

  const lookup = data.reduce<Record<string, PlatformBreakdown>>(
    (acc, item) => {
      acc[item.day] = item.breakdown;
      return acc;
    },
    {},
  );

  labels.forEach((label) => {
    const breakdown = lookup[label] ?? {
      android: 0,
      ios: 0,
      telegram: 0,
      other: 0,
    };
    baseSeries.forEach((serie) => {
      serie.values.push(breakdown[serie.key as keyof PlatformBreakdown] ?? 0);
    });
  });

  return baseSeries;
};

const buildCountSeries = (data: CountTimeSeriesPoint[], labels: string[]) => {
  const lookup = data.reduce<Record<string, number>>((acc, item) => {
    acc[item.day] = item.value;
    return acc;
  }, {});

  return [
    {
      key: 'count',
      label: 'Value',
      color: chartPinkPalette.primary,
      values: labels.map((label) => lookup[label] ?? 0),
    },
  ];
};

const Dashboard: React.FC = () => {
  const [state, setState] = React.useState<DashboardState>({
    data: null,
    loading: true,
    error: null,
  });
  const [presentationMode, setPresentationMode] = React.useState<PresentationMode>(
    'real',
  );

  React.useEffect(() => {
    const storedMode = localStorage.getItem(PRESENTATION_STORAGE_KEY);
    if (storedMode === 'mock' || storedMode === 'real') {
      setPresentationMode(storedMode);
    }
  }, []);

  React.useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const adminJs = (window as unknown as AdminJSGlobal).AdminJS;
        if (!adminJs?.ApiClient) {
          throw new Error('AdminJS API client not available');
        }
        const apiClient = new adminJs.ApiClient();
        const response = await apiClient.getDashboard();
        if (!isMounted) {
          return;
        }
        setState({
          data: response.data ?? null,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Failed to load dashboard';
        setState({ data: null, loading: false, error: message });
      }
    };

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const togglePresentationMode = (mode: PresentationMode) => {
    setPresentationMode(mode);
    localStorage.setItem(PRESENTATION_STORAGE_KEY, mode);
  };

  const effectiveData = React.useMemo(() => {
    if (presentationMode === 'mock') {
      return buildMockDashboardData(12);
    }
    return state.data;
  }, [presentationMode, state.data]);

  if (state.loading) {
    return <div style={loadingStyle}>Loading dashboard...</div>;
  }

  if (state.error) {
    return <div style={errorStyle}>{state.error}</div>;
  }

  if (!effectiveData) {
    return <div style={emptyStateStyle}>No dashboard data available.</div>;
  }

  const chartRangeText = buildDashboardChartRangeText(effectiveData);
  const chartLabels = buildPresentationDateKeys(effectiveData.charts.range.days);
  const userGrowthSeries = buildPlatformChartSeries(
    effectiveData.charts.userGrowth,
    chartLabels,
  );
  const wishGrowthSeries = buildPlatformChartSeries(
    effectiveData.charts.wishGrowth,
    chartLabels,
  );
  const surveyCompletionSeries = buildCountSeries(
    effectiveData.charts.surveyCompletion,
    chartLabels,
  );

  const completionRate =
    effectiveData.totalSurveys > 0
      ? Math.round(
          (effectiveData.completedSurveys / effectiveData.totalSurveys) * 100,
        )
      : 0;

  return (
    <div style={containerStyle}>
      <div style={pageHeaderStyle}>
        <div style={pageIntroTextStyle}>
          <div style={titleStyle}>PostgramX overview</div>
          <div style={pageSubtitleStandaloneStyle}>
            Main operational metrics powered by Telegram Mini App activity.
          </div>
        </div>
        <div style={actionsRowStyle}>
          <span style={presentationToggleStyle}>
            Presentation mode
            <button
              type="button"
              style={{
                ...presentationButtonStyle,
                ...(presentationMode === 'real'
                  ? presentationButtonActiveStyle
                  : {}),
              }}
              onClick={() => togglePresentationMode('real')}
            >
              Live
            </button>
            <button
              type="button"
              style={{
                ...presentationButtonStyle,
                ...(presentationMode === 'mock'
                  ? presentationButtonActiveStyle
                  : {}),
              }}
              onClick={() => togglePresentationMode('mock')}
            >
              Demo
            </button>
          </span>
        </div>
      </div>

      <div style={gridStyle}>
        <DashboardStatCard
          title="Total users"
          value={formatNumber(effectiveData.totalUsers)}
          description="Active Telegram users"
        />
        <DashboardStatCard title="Platforms">
          <PlatformBreakdownList
            breakdown={effectiveData.platformBreakdown}
            labels={{
              android: 'Android',
              ios: 'iOS',
              telegram: 'Telegram',
              other: 'Other',
            }}
          />
        </DashboardStatCard>
        <DashboardStatCard
          title="Wish items"
          value={formatNumber(effectiveData.totalWishItems)}
          description="Saved items from users"
        />
        <DashboardStatCard
          title="Share clicks"
          value={formatNumber(effectiveData.shareProfileClicks)}
          description="Profile shares today"
        />
      </div>

      <div style={gridStyle}>
        <DashboardStatCard title="Wish items by platform">
          <PlatformBreakdownList
            breakdown={effectiveData.wishItemsByPlatform}
            labels={{
              android: 'Android',
              ios: 'iOS',
              telegram: 'Telegram',
              other: 'Other',
            }}
          />
        </DashboardStatCard>
        <DashboardStatCard
          title="Partners"
          value={formatNumber(effectiveData.totalPartners)}
          description="Active business partners"
        />
        <DashboardStatCard
          title="Surveys"
          value={formatNumber(effectiveData.totalSurveys)}
          description="Started by users"
        />
        <DashboardStatCard
          title="Survey completion"
          value={`${completionRate}%`}
          description={`${formatNumber(effectiveData.completedSurveys)} completed`}
        >
          <div style={progressContainerStyle}>
            <div style={progressBarStyle(completionRate)} />
          </div>
        </DashboardStatCard>
      </div>

      <div style={gridStyle}>
        <DashboardStatCard
          title="Onboarding"
          value={formatNumber(effectiveData.onboarding.total)}
          description="Users completed onboarding"
        />
        <DashboardStatCard title="Onboarding by platform">
          <PlatformBreakdownList
            breakdown={effectiveData.onboarding.byPlatform}
            labels={{
              android: 'Android',
              ios: 'iOS',
              telegram: 'Telegram',
              other: 'Other',
            }}
            total={effectiveData.onboarding.total}
          />
        </DashboardStatCard>
        <DashboardStatCard
          title="Today logins"
          value={formatNumber(effectiveData.lastLogin.today)}
          description="Users active today"
        />
        <DashboardStatCard
          title="Completion rate"
          value={`${completionRate}%`}
          description="Survey completion"
        />
      </div>

      <div style={chartSectionStyle}>
        <DashboardChartCard title="User growth" rangeText={chartRangeText}>
          <LineChart labels={chartLabels} series={userGrowthSeries} />
          <div style={chartLegendContainerStyle}>
            {userGrowthSeries.map((series) => (
              <div key={series.key} style={chartLegendItemStyle}>
                <span
                  style={{
                    ...chartLegendMarkerStyle,
                    background: series.color,
                  }}
                />
                {series.label}
              </div>
            ))}
          </div>
        </DashboardChartCard>
        <DashboardChartCard title="Wish growth" rangeText={chartRangeText}>
          <LineChart labels={chartLabels} series={wishGrowthSeries} />
          <div style={chartLegendContainerStyle}>
            {wishGrowthSeries.map((series) => (
              <div key={series.key} style={chartLegendItemStyle}>
                <span
                  style={{
                    ...chartLegendMarkerStyle,
                    background: series.color,
                  }}
                />
                {series.label}
              </div>
            ))}
          </div>
        </DashboardChartCard>
        <DashboardChartCard
          title="Survey completion"
          rangeText={chartRangeText}
        >
          <LineChart
            labels={chartLabels}
            series={surveyCompletionSeries}
            emptyMessage="No surveys completed in this range."
          />
          <div style={chartLegendContainerStyle}>
            <div style={chartLegendItemStyle}>
              <span
                style={{
                  ...chartLegendMarkerStyle,
                  background: chartPinkPalette.primary,
                }}
              />
              Completions
            </div>
          </div>
          <div style={chartFooterStyle}>
            <span>Last {effectiveData.charts.range.days} days</span>
            <span>{formatNumber(effectiveData.completedSurveys)} completions</span>
          </div>
        </DashboardChartCard>
      </div>
    </div>
  );
};

export default Dashboard;
