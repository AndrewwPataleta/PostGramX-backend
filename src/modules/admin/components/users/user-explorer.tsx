import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildUserExplorerUrl } from '../../utils/component-links';
import { formatDisplayDate } from '../../utils/format-date';
import type { UserMessageChannel, UserMessageChannelInfo, UserMessageChannelResult } from '../../types/admin.types';
import type { AdminJSGlobalBase } from '../adminjs-global';
import { SortableTableHeader } from '../sortable-table-header';
import { TablePagination, useTablePagination } from '../table-pagination';
import {
  buttonRowStyle,
  buttonStyle,
  cardContentStyle,
  filterInputStyle,
  headingStyle,
  pageWrapperStyle,
  checkboxInputStyle,
  secondaryButtonStyle,
  statsStyle,
  subHeadingStyle,
  tableStyle,
  tableWrapperStyle,
  tdStyle,
  thStyle,
} from '../table-styles';
import { CollapsibleCard } from '../collapsible-card';
import { useTableSorting } from '../use-table-sorting';
import { OpenLinkButton } from '../open-link-button';

const filterGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
};

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontSize: '13px',
  color: '#374151',
};

const previewRowButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  padding: 0,
  width: '100%',
  textAlign: 'left',
  cursor: 'pointer',
};

const detailGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '12px',
};

const editCheckboxRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '13px',
  color: '#111827',
};

const detailLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
};

const detailValueStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#111827',
  fontWeight: 500,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  margin: '0 0 8px 0',
  color: '#111827',
};

const listContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const listItemStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid #e5e7eb',
  background: '#f9fafb',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const listItemTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#111827',
};

const listItemMetaStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
};

const previewHeaderStyle: React.CSSProperties = {
  ...statsStyle,
  justifyContent: 'space-between',
  alignItems: 'center',
};

const linkButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#b91c1c',
  color: '#fff',
  border: '1px solid #991b1b',
};

const INITIAL_FILTERS = {
  search: '',
  lang: '',
  platformType: '',
  selectedLocation: '',
  locationDefault: '',
  isPremium: 'any' as 'any' | 'true' | 'false',
  isActive: 'any' as 'any' | 'true' | 'false',
  onboardingPass: 'any' as 'any' | 'true' | 'false',
  createdFrom: '',
  createdTo: '',
  lastLoginFrom: '',
  lastLoginTo: '',
};

const selectStyle: React.CSSProperties = {
  ...filterInputStyle,
  appearance: 'none',
};

const listEmptyStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: '13px',
  color: '#6b7280',
};

const sectionWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const inlineSectionsContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
};

const inlineSectionCardStyle: React.CSSProperties = {
  ...sectionWrapperStyle,
  flex: '1 1 320px',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '16px',
  background: '#fff',
};

const infoCardGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '12px',
};

const infoCardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '14px 16px',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const infoCardTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#111827',
};

const infoCardContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const infoCardFieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
};

const detailCardLayoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '16px',
};

const detailCardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '16px',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const messageChannelRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  border: '1px solid #f3f4f6',
  borderRadius: '10px',
  padding: '10px 12px',
  gap: '10px',
};

const messageBadgeStyle = (available: boolean): React.CSSProperties => ({
  padding: '4px 10px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
  color: available ? '#047857' : '#b91c1c',
  background: available ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
});

const messageTextareaStyle: React.CSSProperties = {
  ...filterInputStyle,
  minHeight: '120px',
  resize: 'vertical',
};

const messageFooterStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  alignItems: 'center',
};

const messageStatusTextStyle = (color: string): React.CSSProperties => ({
  color,
  fontSize: '13px',
});

const surveyDetailCardStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '16px',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const surveyDetailHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  gap: '12px',
};

const surveyDetailTitleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 600,
  margin: 0,
  color: '#111827',
};

const surveyDetailMetaStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
};

const surveyDetailActionsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
};

const surveyChatWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const surveyBubbleBaseStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '12px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  border: '1px solid #e5e7eb',
  background: '#f9fafb',
};

const surveyQuestionBubbleStyle: React.CSSProperties = {
  ...surveyBubbleBaseStyle,
  alignSelf: 'flex-start',
  background: '#eef2ff',
  borderColor: '#c7d2fe',
};

const surveyAnswerBubbleStyle: React.CSSProperties = {
  ...surveyBubbleBaseStyle,
  alignSelf: 'flex-end',
  background: '#e0f2fe',
  borderColor: '#bae6fd',
};

const surveyResultsBubbleStyle: React.CSSProperties = {
  ...surveyBubbleBaseStyle,
  alignSelf: 'center',
  background: '#fef3c7',
  borderColor: '#fde68a',
};

const surveyBubbleMetaStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  marginBottom: '4px',
};

const surveyBubbleTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: '#111827',
  margin: '0 0 4px 0',
};

const surveyBubbleContentStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#111827',
  margin: 0,
  whiteSpace: 'pre-wrap',
};

const surveyBubbleListStyle: React.CSSProperties = {
  margin: '4px 0 0 0',
  paddingLeft: '18px',
  fontSize: '12px',
  color: '#6b7280',
};

const surveyBubbleResultsListStyle: React.CSSProperties = {
  margin: '6px 0 0 0',
  paddingLeft: '18px',
  fontSize: '13px',
  color: '#374151',
};

const surveyResultsTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#111827',
  margin: '0 0 8px 0',
};

type InfoCardField = {
  label: string;
  value: React.ReactNode;
};

type InfoCardGroup = {
  title: string;
  fields: InfoCardField[];
};

const InfoFieldList: React.FC<{ fields: InfoCardField[] }> = ({ fields }) => (
  <div style={infoCardContentStyle}>
    {fields.map((field) => (
      <div key={field.label} style={infoCardFieldStyle}>
        <span style={detailLabelStyle}>{field.label}</span>
        <div style={detailValueStyle}>{field.value}</div>
      </div>
    ))}
  </div>
);

const InfoCardGrid: React.FC<{ groups: InfoCardGroup[] }> = ({ groups }) => (
  <div style={infoCardGridStyle}>
    {groups.map((group) => (
      <div key={group.title} style={infoCardStyle}>
        <span style={infoCardTitleStyle}>{group.title}</span>
        <InfoFieldList fields={group.fields} />
      </div>
    ))}
  </div>
);

type FiltersState = typeof INITIAL_FILTERS;

type AdminJSUserExplorerClient = {
  getPage: <T = unknown>(options: {
    pageName: string;
    method?: 'get' | 'post';
    data?: any;
  }) => Promise<{ data?: T } | null>;
  recordAction?: (options: {
    resourceId: string;
    recordId: string;
    actionName: string;
    method?: 'get' | 'post';
    data?: Record<string, unknown>;
  }) => Promise<{ data?: any } | null>;
};

type AdminJSGlobal = AdminJSGlobalBase<AdminJSUserExplorerClient>;

type MetadataPayload = {
  success: true;
  type: 'metadata';
  languages: string[];
  platformTypes: string[];
  locations: string[];
};

type PreviewItem = {
  id: string;
  username: string | null;
  email: string | null;
  fullName: string | null;
  platformType: string | null;
  lang: string | null;
  isPremium: boolean;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  credits: number;
  selectedLocation: string | null;
  locationDefault: string | null;
  followersCount: number;
  followingCount: number;
  wishlistCount: number;
};

type PreviewPayload = {
  success: true;
  type: 'search';
  total: number;
  limit: number;
  items: PreviewItem[];
};

type UserRef = {
  id: string;
  username: string | null;
  email: string | null;
  fullName: string | null;
  platformType: string | null;
  lang: string | null;
  createdAt: string;
};

type WishlistPreview = {
  id: string;
  title: string;
  link: string | null;
  createdAt: string;
  source: string | null;
  isBooked: boolean;
};

type SurveySummary = {
  id: string;
  title: string | null;
  createdAt: string | null;
  resultUnlocked: boolean;
  stepsCount: number;
  resultsCount: number;
};

type SurveyStepType = 'question' | 'answer' | 'results';

type SurveyDetail = {
  id: string;
  title: string | null;
  createdAt: string | null;
  resultUnlocked: boolean;
  user?: UserRef | null;
  steps: Array<{
    id: string;
    type: SurveyStepType;
    title: string | null;
    content: string;
    hints: string[];
    results: Array<{
      name: string;
      description: string | null;
      link: string | null;
    }>;
    createdAt: string | null;
  }>;
  results: Array<{
    id: string;
    name: string;
    link: string | null;
    description: string | null;
    image: string | null;
    wishItem: { id: string; title: string } | null;
  }>;
};

const surveyStepTypeLabels: Record<SurveyStepType, string> = {
  question: 'Question',
  answer: 'Answer',
  results: 'Results',
};

type PreferencesBlock = {
  bio: string | null;
  hobbies: string[];
  favoriteColors: string[];
  foodPreferences: string[];
  techPreferences: string[];
  wishlistVibes: string[];
  styleAndSizes: Record<string, string> | null;
};

type SettingsBlock = {
  receivePromotionalNotifications: boolean;
  notifyOnFollow: boolean;
  notifyOnGiftBooked: boolean;
  notifyOnFriendNewGift: boolean;
  soundOnClick: boolean;
  vibrationFeedback: boolean;
};

type DetailPayload = {
  success: true;
  type: 'details';
  user: {
    id: string;
    username: string | null;
    email: string | null;
    appleId: string | null;
    firstName: string | null;
    lastName: string | null;
    lang: string | null;
    platformType: string | null;
    isPremium: boolean;
    isActive: boolean;
    onboardingPass: boolean;
    secretOnboardingPass: boolean;
    credits: number;
    createdAt: string;
    lastLoginAt: string | null;
    selectedLocation: string | null;
    locationDefault: string | null;
    telegramId: string | null;
    googleId: string | null;
    fbPushToken: string | null;
    iosToken: string | null;
    authType: string | null;
    shareProfileId: string | null;
    stats: {
      followers: number;
      following: number;
      wishlist: number;
    };
    settings: SettingsBlock;
    preferences: PreferencesBlock;
    followers: UserRef[];
    following: UserRef[];
    wishlist: WishlistPreview[];
    surveys: SurveySummary[];
  };
};

type SurveyDetailPayload = {
  success: true;
  type: 'details';
  survey: SurveyDetail;
};

type DeletePayload = {
  success: true;
  type: 'delete';
  userId: string;
};

type EditableUserFormState = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  lang: string;
  selectedLocation: string;
  locationDefault: string;
  credits: string;
  platformType: string;
  authType: string;
  telegramId: string;
  googleId: string;
  appleId: string;
  fbPushToken: string;
  iosToken: string;
  shareProfileId: string;
  isPremium: boolean;
  isActive: boolean;
  onboardingPass: boolean;
  secretOnboardingPass: boolean;
};

type EditableTextField =
  | 'firstName'
  | 'lastName'
  | 'username'
  | 'email'
  | 'lang'
  | 'selectedLocation'
  | 'locationDefault'
  | 'credits'
  | 'platformType'
  | 'authType'
  | 'telegramId'
  | 'googleId'
  | 'appleId'
  | 'fbPushToken'
  | 'iosToken'
  | 'shareProfileId';

type EditableBooleanField = 'isPremium' | 'isActive' | 'onboardingPass' | 'secretOnboardingPass';

const INITIAL_EDIT_FORM: EditableUserFormState = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  lang: '',
  selectedLocation: '',
  locationDefault: '',
  credits: '',
  platformType: '',
  authType: '',
  telegramId: '',
  googleId: '',
  appleId: '',
  fbPushToken: '',
  iosToken: '',
  shareProfileId: '',
  isPremium: false,
  isActive: false,
  onboardingPass: false,
  secretOnboardingPass: false,
};

const channelKeys: UserMessageChannel[] = ['telegram'];

const channelLabels: Record<UserMessageChannel, string> = {
  telegram: 'Telegram',
};

const defaultChannelInfo: UserMessageChannelInfo = {
  telegram: { available: false, reason: null },
};

const normalizeChannelInfo = (source?: Partial<UserMessageChannelInfo>): UserMessageChannelInfo => {
  const normalizeState = (state?: UserMessageChannelInfo[keyof UserMessageChannelInfo]) => ({
    available: Boolean(state?.available),
    reason: typeof state?.reason === 'string' ? state.reason : null,
  });

  return {
    telegram: normalizeState(source?.telegram),
  };
};

const hasAvailableChannels = (info: UserMessageChannelInfo) =>
  channelKeys.some((channel) => info[channel].available);

type ErrorPayload = {
  success: false;
  message: string;
  details?: string[];
};

type SurveyDetailState = {
  loading: boolean;
  error: string | null;
  surveyId: string | null;
  data: SurveyDetail | null;
};

const buildInitialSurveyDetailState = (): SurveyDetailState => ({
  loading: false,
  error: null,
  surveyId: null,
  data: null,
});

const UserExplorer: React.FC = () => {
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [metadataState, setMetadataState] = useState<{
    loading: boolean;
    error: string | null;
    data: MetadataPayload | null;
  }>({ loading: true, error: null, data: null });
  const [previewState, setPreviewState] = useState<{
    loading: boolean;
    error: string | null;
    total: number;
    items: PreviewItem[];
  }>({ loading: true, error: null, total: 0, items: [] });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUserIdRef = useRef<string | null>(null);
  const [detailsState, setDetailsState] = useState<{
    loading: boolean;
    error: string | null;
    data: DetailPayload['user'] | null;
  }>({ loading: false, error: null, data: null });
  const [editFormState, setEditFormState] = useState<EditableUserFormState>(INITIAL_EDIT_FORM);
  const [updateState, setUpdateState] = useState<{ saving: boolean; error: string | null; success: string | null }>({
    saving: false,
    error: null,
    success: null,
  });
  const [deleteState, setDeleteState] = useState<{
    running: boolean;
    error: string | null;
    success: string | null;
  }>({ running: false, error: null, success: null });
  const [channelInfo, setChannelInfo] = useState<UserMessageChannelInfo>(defaultChannelInfo);
  const [messageText, setMessageText] = useState('');
  const [messageStatus, setMessageStatus] = useState<'idle' | 'loading' | 'sending' | 'success' | 'error'>(
    'idle',
  );
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageResults, setMessageResults] = useState<UserMessageChannelResult[] | null>(null);
  const [messageNotice, setMessageNotice] = useState<string | null>(null);
  const selectedUser = detailsState.data;
  const [surveyDetailsState, setSurveyDetailsState] = useState<SurveyDetailState>(
    buildInitialSurveyDetailState(),
  );

  const resetSurveyDetailsState = useCallback(() => {
    setSurveyDetailsState(buildInitialSurveyDetailState());
  }, []);

  const previewSorters = useMemo(
    () => ({
      user: (item: PreviewItem) => item.fullName ?? item.username ?? '',
      email: (item: PreviewItem) => item.email ?? '',
      platform: (item: PreviewItem) => item.platformType ?? '',
      language: (item: PreviewItem) => item.lang ?? '',
      premium: (item: PreviewItem) => item.isPremium,
      active: (item: PreviewItem) => item.isActive,
      wishlist: (item: PreviewItem) => item.wishlistCount,
      subscriptions: (item: PreviewItem) => item.followingCount,
      followers: (item: PreviewItem) => item.followersCount,
      lastLogin: (item: PreviewItem) =>
        item.lastLoginAt ? new Date(item.lastLoginAt) : null,
      createdAt: (item: PreviewItem) => new Date(item.createdAt),
    }),
    [],
  );

  const { sortedData: sortedPreviewItems, sortConfig, toggleSort } = useTableSorting(
    previewState.items,
    previewSorters,
  );

  const {
    paginatedData: paginatedPreviewItems,
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    setCurrentPage,
    setPageSize,
  } = useTablePagination(sortedPreviewItems);

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  useEffect(() => {
    resetSurveyDetailsState();
  }, [selectedUserId, resetSurveyDetailsState]);

  useEffect(() => {
    setDeleteState({ running: false, error: null, success: null });
  }, [selectedUserId]);

  const adminGlobal = useMemo(() => window.AdminJS as AdminJSGlobal | undefined, []);

  const getApiClient = useCallback(() => {
    const ApiClient = adminGlobal?.ApiClient;
    if (!ApiClient) {
      throw new Error('AdminJS ApiClient is not available in the browser.');
    }
    return new ApiClient();
  }, [adminGlobal]);

  const fetchMetadata = useCallback(async () => {
    setMetadataState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const apiClient = getApiClient();
      const response = await apiClient.getPage<MetadataPayload | ErrorPayload>({
        pageName: 'userExplorer',
        method: 'get',
      });
      const payload = response?.data;
      if (!payload || payload.success !== true || payload.type !== 'metadata') {
        const message = payload && payload.success === false ? payload.message : 'Failed to load filter metadata.';
        throw new Error(message);
      }
      setMetadataState({ loading: false, error: null, data: payload });
    } catch (error) {
      setMetadataState({
        loading: false,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load filter metadata. Try refreshing the page.',
      });
    }
  }, [getApiClient]);

const buildPayloadFilters = useCallback((source: FiltersState) => {
    const payload: Record<string, unknown> = {};
    const trimmedSearch = source.search.trim();
    if (trimmedSearch.length) {
      payload.search = trimmedSearch;
    }
    if (source.lang) {
      payload.lang = source.lang;
    }
    if (source.platformType) {
      payload.platformType = source.platformType;
    }
    if (source.selectedLocation) {
      payload.selectedLocation = source.selectedLocation;
    }
    if (source.locationDefault) {
      payload.locationDefault = source.locationDefault;
    }
    if (source.isPremium !== 'any') {
      payload.isPremium = source.isPremium === 'true';
    }
    if (source.isActive !== 'any') {
      payload.isActive = source.isActive === 'true';
    }
    if (source.onboardingPass !== 'any') {
      payload.onboardingPass = source.onboardingPass === 'true';
    }
    if (source.createdFrom) {
      payload.createdFrom = source.createdFrom;
    }
    if (source.createdTo) {
      payload.createdTo = source.createdTo;
    }
    if (source.lastLoginFrom) {
      payload.lastLoginFrom = source.lastLoginFrom;
    }
    if (source.lastLoginTo) {
      payload.lastLoginTo = source.lastLoginTo;
    }
    return payload;
  }, []);

  const fetchDetails = useCallback(
    async (userId: string) => {
      setDetailsState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const apiClient = getApiClient();
        const response = await apiClient.getPage<DetailPayload | ErrorPayload>({
          pageName: 'userExplorer',
          method: 'post',
          data: { action: 'details', userId },
        });
        const payload = response?.data;
        if (!payload || payload.success !== true || payload.type !== 'details') {
          const message = payload && payload.success === false ? payload.message : 'Failed to load user profile.';
          throw new Error(message);
        }
        setDetailsState({ loading: false, error: null, data: payload.user });
      } catch (error) {
        setDetailsState({
          loading: false,
          data: null,
          error:
            error instanceof Error
              ? error.message
              : 'Failed to load user profile. Please try again.',
        });
      }
    },
    [getApiClient],
  );

  const fetchChannelInfo = useCallback(
    async (userId: string) => {
      const ApiClient = adminGlobal?.ApiClient;
      if (!ApiClient) {
        setMessageError('AdminJS ApiClient is not available.');
        setMessageStatus('error');
        return;
      }

      const apiInstance = new ApiClient() as AdminJSUserExplorerClient;
      if (typeof apiInstance.recordAction !== 'function') {
        setMessageError('Message sending method is not available.');
        setMessageStatus('error');
        return;
      }

      setMessageStatus('loading');
      setMessageError(null);
      setMessageNotice(null);
      setMessageResults(null);

      try {
        const response = await apiInstance.recordAction({
          resourceId: 'User',
          recordId: userId,
          actionName: 'sendMessage',
          method: 'get',
        });
        const payload = response?.data;
        const channelInfoData = (payload?.data as any)?.channelInfo ?? payload?.channelInfo;
        setChannelInfo(normalizeChannelInfo(channelInfoData ?? undefined));
        setMessageStatus('idle');
      } catch (error) {
        setChannelInfo({ ...defaultChannelInfo });
        setMessageStatus('error');
        setMessageError(
          error instanceof Error ? error.message : 'Failed to load available delivery channels.',
        );
      }
    },
    [adminGlobal],
  );

  const handleSendMessage = useCallback(async () => {
    if (!selectedUser) {
      setMessageError('Select a user first.');
      return;
    }

    const ApiClient = adminGlobal?.ApiClient;
    if (!ApiClient) {
      setMessageError('AdminJS ApiClient is not available.');
      return;
    }

    const trimmed = messageText.trim();
    if (!trimmed) {
      setMessageError('Enter a message.');
      return;
    }

    if (!hasAvailableChannels(channelInfo)) {
      setMessageError('No available delivery channels.');
      return;
    }

    const apiInstance = new ApiClient() as AdminJSUserExplorerClient;
    if (typeof apiInstance.recordAction !== 'function') {
      setMessageError('Message sending method is not available.');
      return;
    }

    setMessageStatus('sending');
    setMessageError(null);
    setMessageNotice(null);

    try {
      const response = await apiInstance.recordAction({
        resourceId: 'User',
        recordId: selectedUser.id,
        actionName: 'sendMessage',
        method: 'post',
        data: { message: trimmed },
      });

      const payload = response?.data;
      const data = payload?.data ?? {};
      setChannelInfo(normalizeChannelInfo((data as any).channelInfo));
      setMessageResults(
        Array.isArray((data as any).result) ? ((data as any).result as UserMessageChannelResult[]) : null,
      );
      const noticeMessage = payload?.notice?.message ?? null;
      setMessageNotice(noticeMessage);
      setMessageStatus(payload?.notice?.type === 'success' ? 'success' : 'error');
    } catch (error) {
      setMessageStatus('error');
      setMessageError(error instanceof Error ? error.message : 'Failed to send message.');
    }
  }, [adminGlobal, channelInfo, messageText]);

  const fetchPreview = useCallback(
    async (currentFilters: FiltersState, options: { autoSelect?: boolean } = {}) => {
      setPreviewState((prev) => ({ ...prev, loading: true, error: null }));
      const payloadFilters = buildPayloadFilters(currentFilters);
      try {
        const apiClient = getApiClient();
        const response = await apiClient.getPage<PreviewPayload | ErrorPayload>({
          pageName: 'userExplorer',
          method: 'post',
          data: { action: 'search', filters: payloadFilters },
        });
        const payload = response?.data;
        if (!payload || payload.success !== true || payload.type !== 'search') {
          const message = payload && payload.success === false ? payload.message : 'Failed to fetch users list.';
          throw new Error(message);
        }
        setPreviewState({ loading: false, error: null, total: payload.total, items: payload.items });
        if (payload.items.length === 0) {
          setSelectedUserId(null);
          setDetailsState({ loading: false, error: null, data: null });
          return;
        }
        const autoSelect = options.autoSelect ?? true;
        const currentSelectedId = selectedUserIdRef.current;
        let nextId: string | null = null;
        if (autoSelect) {
          nextId = payload.items[0]?.id ?? null;
        } else if (currentSelectedId && payload.items.some((item) => item.id === currentSelectedId)) {
          nextId = currentSelectedId;
        } else {
          nextId = payload.items[0]?.id ?? null;
        }
        if (nextId && nextId !== currentSelectedId) {
          setSelectedUserId(nextId);
          await fetchDetails(nextId);
        } else if (nextId) {
          await fetchDetails(nextId);
        }
      } catch (error) {
        setPreviewState({
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch users list.',
          total: 0,
          items: [],
        });
      }
    },
    [buildPayloadFilters, fetchDetails, getApiClient],
  );

  const handleLoadSurveyDetails = useCallback(
    async (surveyId: string) => {
      setSurveyDetailsState({ loading: true, error: null, surveyId, data: null });
      try {
        const apiClient = getApiClient();
        const response = await apiClient.getPage<SurveyDetailPayload | ErrorPayload>({
          pageName: 'surveyExplorer',
          method: 'post',
          data: {
            action: 'details',
            surveyId,
          },
        });

        if (response?.data && response.data.success && response.data.type === 'details') {
          setSurveyDetailsState({
            loading: false,
            error: null,
            surveyId,
            data: response.data.survey,
          });
        } else {
          const message =
            (response?.data as ErrorPayload | undefined)?.message ||
            'Failed to load survey details.';
          setSurveyDetailsState({ loading: false, error: message, surveyId, data: null });
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown error';
        setSurveyDetailsState({ loading: false, error: reason, surveyId, data: null });
      }
    },
    [getApiClient],
  );

  const handleCloseSurveyDetails = useCallback(() => {
    resetSurveyDetailsState();
  }, [resetSurveyDetailsState]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const searchValue = searchParams?.get('search')?.trim();
    if (searchValue) {
      const nextFilters = { ...INITIAL_FILTERS, search: searchValue };
      setFilters(nextFilters);
      fetchPreview(nextFilters, { autoSelect: true });
      return;
    }
    fetchPreview(INITIAL_FILTERS);
  }, [fetchPreview]);

  const handleInputChange = useCallback(
    (key: keyof FiltersState) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      fetchPreview(filters, { autoSelect: true });
    },
    [fetchPreview, filters],
  );

  const handleReset = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    fetchPreview(INITIAL_FILTERS, { autoSelect: true });
  }, [fetchPreview]);

  const formatDateTime = useCallback((value: string | null) => {
    return formatDisplayDate(value);
  }, []);

  const formatBoolean = useCallback((value: boolean) => (value ? 'Yes' : 'No'), []);

  const renderSurveyDetailsCard = () => {
    if (!surveyDetailsState.surveyId) {
      return null;
    }

    const survey = surveyDetailsState.data;
    const metaParts: string[] = [];

    if (survey?.createdAt) {
      metaParts.push(`Created: ${formatDateTime(survey.createdAt)}`);
    }
    if (survey) {
      metaParts.push(`Steps: ${survey.steps.length}`);
      metaParts.push(`Results: ${survey.results.length}`);
      metaParts.push(`Results unlocked: ${formatBoolean(survey.resultUnlocked)}`);
    }

    return (
      <div style={surveyDetailCardStyle}>
        <div style={surveyDetailHeaderStyle}>
          <div>
            <h4 style={surveyDetailTitleStyle}>{survey?.title ?? 'Untitled survey'}</h4>
            <div style={surveyDetailMetaStyle}>ID: {surveyDetailsState.surveyId}</div>
            {metaParts.length > 0 && (
              <div style={surveyDetailMetaStyle}>{metaParts.join(' · ')}</div>
            )}
          </div>
          <div style={surveyDetailActionsStyle}>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() =>
                surveyDetailsState.surveyId && handleLoadSurveyDetails(surveyDetailsState.surveyId)
              }
              disabled={surveyDetailsState.loading}
            >
              Refresh
            </button>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={handleCloseSurveyDetails}
              disabled={surveyDetailsState.loading}
            >
              Close
            </button>
          </div>
        </div>
        {surveyDetailsState.loading ? (
          <div style={listEmptyStyle}>Loading survey details...</div>
        ) : surveyDetailsState.error ? (
          <div style={{ ...listEmptyStyle, color: '#dc2626' }}>{surveyDetailsState.error}</div>
        ) : survey ? (
          <>
            <div style={surveyChatWrapperStyle}>
              {survey.steps.length === 0 ? (
                <div style={listEmptyStyle}>Survey dialog is empty.</div>
              ) : (
                survey.steps.map((step) => {
                  const bubbleStyle =
                    step.type === 'question'
                      ? surveyQuestionBubbleStyle
                      : step.type === 'answer'
                        ? surveyAnswerBubbleStyle
                        : surveyResultsBubbleStyle;
                  return (
                    <div key={step.id} style={bubbleStyle}>
                      <div style={surveyBubbleMetaStyle}>
                        {surveyStepTypeLabels[step.type]}
                        {step.createdAt ? ` · ${formatDateTime(step.createdAt)}` : ''}
                      </div>
                      {step.title && <div style={surveyBubbleTitleStyle}>{step.title}</div>}
                      <p style={surveyBubbleContentStyle}>{step.content}</p>
                      {step.hints.length > 0 && (
                        <ul style={surveyBubbleListStyle}>
                          {step.hints.map((hint, index) => (
                            <li key={`${step.id}-hint-${index}`}>{hint}</li>
                          ))}
                        </ul>
                      )}
                      {step.results.length > 0 && (
                        <ul style={surveyBubbleResultsListStyle}>
                          {step.results.map((result, index) => (
                            <li key={`${step.id}-result-${index}`}>
                              <strong>{result.name}</strong>
                              {result.description ? ` — ${result.description}` : ''}
                              {result.link && (
                                <>
                                  {' · '}
                                  <a href={result.link} target="_blank" rel="noreferrer">
                                    link
                                  </a>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div>
              <h4 style={surveyResultsTitleStyle}>Results</h4>
              {survey.results.length === 0 ? (
                <div style={listEmptyStyle}>Results are not available yet.</div>
              ) : (
                <div style={tableWrapperStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Suggestion</th>
                        <th style={thStyle}>Description</th>
                        <th style={thStyle}>Link</th>
                        <th style={thStyle}>Wish</th>
                      </tr>
                    </thead>
                    <tbody>
                      {survey.results.map((result) => (
                        <tr key={result.id}>
                          <td style={tdStyle}>{result.name}</td>
                          <td style={{ ...tdStyle, whiteSpace: 'normal' }}>
                            {result.description ?? '—'}
                          </td>
                          <td style={tdStyle}>
                            {result.link ? (
                              <a href={result.link} target="_blank" rel="noreferrer">
                                open
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={tdStyle}>
                            {result.wishItem ? (
                              <a
                                href={`/admin/resources/WishItem/records/${encodeURIComponent(result.wishItem.id)}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {result.wishItem.title}
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={listEmptyStyle}>Select a survey to see details.</div>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (selectedUser) {
      fetchChannelInfo(selectedUser.id);
      setMessageText('');
      setMessageResults(null);
      setMessageNotice(null);
      setMessageStatus('idle');
      setMessageError(null);
    } else {
      setChannelInfo({ ...defaultChannelInfo });
      setMessageText('');
      setMessageResults(null);
      setMessageNotice(null);
      setMessageStatus('idle');
      setMessageError(null);
    }
  }, [fetchChannelInfo, selectedUser]);

  useEffect(() => {
    if (selectedUser) {
      setEditFormState({
        firstName: selectedUser.firstName ?? '',
        lastName: selectedUser.lastName ?? '',
        username: selectedUser.username ?? '',
        email: selectedUser.email ?? '',
        lang: selectedUser.lang ?? '',
        selectedLocation: selectedUser.selectedLocation ?? '',
        locationDefault: selectedUser.locationDefault ?? '',
        credits: selectedUser.credits != null ? String(selectedUser.credits) : '',
        platformType: selectedUser.platformType ?? '',
        authType: selectedUser.authType ?? '',
        telegramId: selectedUser.telegramId ?? '',
        googleId: selectedUser.googleId ?? '',
        appleId: selectedUser.appleId ?? '',
        fbPushToken: selectedUser.fbPushToken ?? '',
        iosToken: selectedUser.iosToken ?? '',
        shareProfileId: selectedUser.shareProfileId ?? '',
        isPremium: selectedUser.isPremium,
        isActive: selectedUser.isActive,
        onboardingPass: selectedUser.onboardingPass,
        secretOnboardingPass: selectedUser.secretOnboardingPass,
      });
    } else {
      setEditFormState({ ...INITIAL_EDIT_FORM });
    }
    setUpdateState({ saving: false, error: null, success: null });
  }, [selectedUser]);

const handleEditTextChange = useCallback(
  (key: EditableTextField) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setEditFormState((prev) => ({ ...prev, [key]: value }));
  },
  [],
);

const handleEditSelectChange = useCallback(
  (key: EditableTextField) => (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setEditFormState((prev) => ({ ...prev, [key]: value }));
  },
  [],
);

  const handleEditCheckboxChange = useCallback(
    (key: EditableBooleanField) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      setEditFormState((prev) => ({ ...prev, [key]: checked }));
    },
    [],
  );

  const handleEditSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedUser) {
        return;
      }

      const normalizeString = (value: string) => {
        const trimmed = value.trim();
        return trimmed.length === 0 ? null : trimmed;
      };

      const creditsRaw = editFormState.credits.trim();
      const parsedCredits = creditsRaw === '' ? null : Number(creditsRaw);
      const normalizedCredits =
        parsedCredits === null || !Number.isFinite(parsedCredits)
          ? undefined
          : Math.max(0, Math.round(parsedCredits));

      const updates: Record<string, unknown> = {
        firstName: normalizeString(editFormState.firstName),
        lastName: normalizeString(editFormState.lastName),
        username: normalizeString(editFormState.username),
        email: normalizeString(editFormState.email),
        lang: normalizeString(editFormState.lang),
        selectedLocation: normalizeString(editFormState.selectedLocation),
        locationDefault: normalizeString(editFormState.locationDefault),
        platformType: normalizeString(editFormState.platformType),
        authType: normalizeString(editFormState.authType),
        telegramId: normalizeString(editFormState.telegramId),
        googleId: normalizeString(editFormState.googleId),
        appleId: normalizeString(editFormState.appleId),
        fbPushToken: normalizeString(editFormState.fbPushToken),
        iosToken: normalizeString(editFormState.iosToken),
        shareProfileId: normalizeString(editFormState.shareProfileId),
        isPremium: editFormState.isPremium,
        isActive: editFormState.isActive,
        onboardingPass: editFormState.onboardingPass,
        secretOnboardingPass: editFormState.secretOnboardingPass,
      };

      if (normalizedCredits !== undefined) {
        updates.credits = normalizedCredits;
      }

      setUpdateState({ saving: true, error: null, success: null });
      try {
        const apiClient = getApiClient();
        const response = await apiClient.getPage<DetailPayload | ErrorPayload>({
          pageName: 'userExplorer',
          method: 'post',
          data: {
            action: 'update',
            userId: selectedUser.id,
            updates,
          },
        });
        const payload = response?.data;
        if (!payload || payload.success !== true || payload.type !== 'details') {
          const message =
            payload && payload.success === false ? payload.message : 'Failed to update user.';
          throw new Error(message);
        }
        setDetailsState({ loading: false, error: null, data: payload.user });
        setUpdateState({ saving: false, error: null, success: 'Changes saved.' });
        fetchPreview(filters, { autoSelect: false });
      } catch (error) {
        setUpdateState({
          saving: false,
          error: error instanceof Error ? error.message : 'Failed to update user. Please try again.',
          success: null,
        });
      }
    },
    [editFormState, fetchPreview, filters, getApiClient, selectedUser],
  );

  const handleDeleteUser = useCallback(async () => {
    if (!selectedUser) {
      return;
    }

    const identifier =
      selectedUser.username ||
      selectedUser.email ||
      [selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(' ') ||
      selectedUser.id;

    const confirmed = window.confirm(
      `Delete user ${identifier}? This will remove their gifts, subscriptions, and related data permanently.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleteState({ running: true, error: null, success: null });
    try {
      const apiClient = getApiClient();
      const response = await apiClient.getPage<DeletePayload | ErrorPayload>({
        pageName: 'userExplorer',
        method: 'post',
        data: {
          action: 'delete',
          userId: selectedUser.id,
        },
      });

      const payload = response?.data;
      if (!payload || payload.success !== true || payload.type !== 'delete') {
        const message =
          payload && payload.success === false
            ? payload.message
            : 'Failed to delete user.';
        throw new Error(message);
      }

      setDeleteState({ running: false, error: null, success: 'User deleted.' });
      setSelectedUserId(null);
      selectedUserIdRef.current = null;
      setDetailsState({ loading: false, error: null, data: null });
      setEditFormState(INITIAL_EDIT_FORM);
      setChannelInfo(defaultChannelInfo);
      setMessageText('');
      setMessageStatus('idle');
      setMessageError(null);
      setMessageNotice(null);
      setMessageResults(null);
      resetSurveyDetailsState();
      fetchPreview(filters, { autoSelect: false });
    } catch (error) {
      setDeleteState({
        running: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete user. Please try again.',
        success: null,
      });
    }
  }, [
    fetchPreview,
    filters,
    getApiClient,
    resetSurveyDetailsState,
    selectedUser,
    selectedUserIdRef,
  ]);

  const metadata = metadataState.data;
  const locationOptions = metadata?.locations ?? [];

  return (
    <div style={pageWrapperStyle}>
      <CollapsibleCard>
        <div style={cardContentStyle}>
          <div>
            <h1 style={headingStyle}>Users</h1>
            <p style={subHeadingStyle}>
              Find users with filters, review a quick profile, and open the full card with
              subscriptions, followers, wishlists, and preferences.
            </p>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={filterGridStyle}>
              <label style={labelStyle}>
                Search
                <input
                  style={filterInputStyle}
                  placeholder="Name, email, ID, or username"
                  value={filters.search}
                  onChange={handleInputChange('search')}
                />
              </label>
              <label style={labelStyle}>
                Language
                <select style={selectStyle} value={filters.lang} onChange={handleInputChange('lang')}>
                  <option value="">Any</option>
                  {(metadata?.languages ?? []).map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                Platform
                <select style={selectStyle} value={filters.platformType} onChange={handleInputChange('platformType')}>
                  <option value="">Any</option>
                  {(metadata?.platformTypes ?? []).map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                Default country
                <select style={selectStyle} value={filters.locationDefault} onChange={handleInputChange('locationDefault')}>
                  <option value="">Any</option>
                  {(metadata?.locations ?? []).map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                Selected country
                <select style={selectStyle} value={filters.selectedLocation} onChange={handleInputChange('selectedLocation')}>
                  <option value="">Any</option>
                  {(metadata?.locations ?? []).map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </label>
              <label style={labelStyle}>
                Premium
                <select style={selectStyle} value={filters.isPremium} onChange={handleInputChange('isPremium')}>
                  <option value="any">Any</option>
                  <option value="true">Premium only</option>
                  <option value="false">No premium</option>
                </select>
              </label>
              <label style={labelStyle}>
                Active
                <select style={selectStyle} value={filters.isActive} onChange={handleInputChange('isActive')}>
                  <option value="any">Any</option>
                  <option value="true">Active</option>
                  <option value="false">Blocked</option>
                </select>
              </label>
              <label style={labelStyle}>
                Onboarding
                <select style={selectStyle} value={filters.onboardingPass} onChange={handleInputChange('onboardingPass')}>
                  <option value="any">Any</option>
                  <option value="true">Completed</option>
                  <option value="false">Not completed</option>
                </select>
              </label>
              <label style={labelStyle}>
                Created from
                <input
                  type="date"
                  style={filterInputStyle}
                  value={filters.createdFrom}
                  onChange={handleInputChange('createdFrom')}
                />
              </label>
              <label style={labelStyle}>
                Created to
                <input
                  type="date"
                  style={filterInputStyle}
                  value={filters.createdTo}
                  onChange={handleInputChange('createdTo')}
                />
              </label>
              <label style={labelStyle}>
                Last login from
                <input
                  type="date"
                  style={filterInputStyle}
                  value={filters.lastLoginFrom}
                  onChange={handleInputChange('lastLoginFrom')}
                />
              </label>
              <label style={labelStyle}>
                Last login to
                <input
                  type="date"
                  style={filterInputStyle}
                  value={filters.lastLoginTo}
                  onChange={handleInputChange('lastLoginTo')}
                />
              </label>
            </div>
            <div style={buttonRowStyle}>
              <button type="submit" style={buttonStyle} disabled={previewState.loading}>
                Apply filters
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={handleReset} disabled={previewState.loading}>
                Reset
              </button>
            </div>
          </form>
          {metadataState.error && <div style={listEmptyStyle}>{metadataState.error}</div>}
        </div>
      </CollapsibleCard>

      <CollapsibleCard>
        <div style={cardContentStyle}>
          <div style={previewHeaderStyle}>
            <div>Users found: {previewState.total}</div>
            {previewState.loading && <div>Loading list...</div>}
            {previewState.error && <div style={{ color: '#dc2626' }}>{previewState.error}</div>}
          </div>
        </div>
        <div style={tableWrapperStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <SortableTableHeader
                  columnKey="user"
                  label="User"
                  sortConfig={sortConfig}
                  onSort={toggleSort}
                />
                <SortableTableHeader
                  columnKey="email"
                  label="Email"
                  sortConfig={sortConfig}
                  onSort={toggleSort}
                />
                <SortableTableHeader
                  columnKey="platform"
                  label="Platform"
                  sortConfig={sortConfig}
                  onSort={toggleSort}
                />
                <SortableTableHeader
                  columnKey="language"
                  label="Language"
                  sortConfig={sortConfig}
                  onSort={toggleSort}
                />
                <SortableTableHeader
                  columnKey="premium"
                  label="Premium"
                  sortConfig={sortConfig}
                  onSort={toggleSort}
                />
                <SortableTableHeader
                  columnKey="active"
                  label="Active"
                  sortConfig={sortConfig}
                  onSort={toggleSort}
                />
                <SortableTableHeader
                  columnKey="wishlist"
                  label="Wishlist"
                  sortConfig={sortConfig}
                  onSort={toggleSort}
                  align="right"
                />
                <SortableTableHeader
                  columnKey="subscriptions"
                  label="Following"
                  sortConfig={sortConfig}
                  onSort={toggleSort}
                  align="right"
                />
                <SortableTableHeader
                  columnKey="followers"
                  label="Followers"
                  sortConfig={sortConfig}
                  onSort={toggleSort}
                  align="right"
                />
                <SortableTableHeader
                  columnKey="lastLogin"
                  label="Last login"
                  sortConfig={sortConfig}
                  onSort={toggleSort}
                />
                <SortableTableHeader
                  columnKey="createdAt"
                  label="Created"
                  sortConfig={sortConfig}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {sortedPreviewItems.length === 0 && !previewState.loading ? (
                <tr>
                  <td style={{ ...tdStyle, textAlign: 'center' }} colSpan={11}>
                    No users found for the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedPreviewItems.map((item) => {
                  const isSelected = item.id === selectedUserId;
                  return (
                    <tr
                      key={item.id}
                      style={{ background: isSelected ? '#FDF6F5' : 'transparent' }}
                      onClick={() => {
                        setSelectedUserId(item.id);
                        fetchDetails(item.id);
                      }}
                    >
                      <td style={tdStyle}>
                        <button
                          type="button"
                          style={previewRowButtonStyle}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedUserId(item.id);
                            fetchDetails(item.id);
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>{item.fullName ?? item.username ?? 'No name'}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>{item.username ?? '—'}</div>
                        </button>
                      </td>
                      <td style={tdStyle}>{item.email ?? '—'}</td>
                      <td style={tdStyle}>{item.platformType ?? '—'}</td>
                      <td style={tdStyle}>{item.lang ?? '—'}</td>
                      <td style={tdStyle}>{formatBoolean(item.isPremium)}</td>
                      <td style={tdStyle}>{formatBoolean(item.isActive)}</td>
                      <td style={tdStyle}>{item.wishlistCount}</td>
                      <td style={tdStyle}>{item.followingCount}</td>
                      <td style={tdStyle}>{item.followersCount}</td>
                      <td style={tdStyle}>{formatDateTime(item.lastLoginAt)}</td>
                      <td style={tdStyle}>{formatDateTime(item.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          totalItems={totalItems}
          startIndex={startIndex}
          endIndex={endIndex}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </CollapsibleCard>

      <CollapsibleCard>
        <div style={cardContentStyle}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2 style={headingStyle}>User card</h2>
              <p style={subHeadingStyle}>View detailed info, subscriptions, wishlist, and preferences.</p>
            </div>
            {selectedUser && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <a
                    href={buildUserExplorerUrl(selectedUser.id)}
                    target="_blank"
                    rel="noreferrer"
                    style={linkButtonStyle}
                  >
                    Open profile
                  </a>
                  <button
                    type="button"
                    style={{
                      ...dangerButtonStyle,
                      opacity: deleteState.running ? 0.85 : 1,
                    }}
                    onClick={handleDeleteUser}
                    disabled={deleteState.running}
                  >
                    {deleteState.running ? 'Deleting...' : 'Delete user'}
                  </button>
                </div>
                {(deleteState.error || deleteState.success) && (
                  <span style={{ color: deleteState.error ? '#dc2626' : '#059669', fontSize: '12px' }}>
                    {deleteState.error ?? deleteState.success}
                  </span>
                )}
              </div>
            )}
          </div>
          {detailsState.loading && <div>Loading profile...</div>}
          {detailsState.error && <div style={{ color: '#dc2626' }}>{detailsState.error}</div>}
          {!detailsState.loading && !selectedUser && !detailsState.error && (
            <div style={listEmptyStyle}>Select a user in the table to view details.</div>
          )}
          {selectedUser && !detailsState.loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={detailCardLayoutStyle}>
                <section style={detailCardStyle}>
                  <h3 style={sectionTitleStyle}>Edit user</h3>
                  <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={detailGridStyle}>
                      {(
                        [
                          { label: 'First name', key: 'firstName' },
                          { label: 'Last name', key: 'lastName' },
                          { label: 'Username', key: 'username' },
                          { label: 'Email', key: 'email' },
                          { label: 'Language', key: 'lang' },
                          { label: 'Platform', key: 'platformType' },
                          { label: 'Auth type', key: 'authType' },
                          { label: 'Telegram ID', key: 'telegramId' },
                          { label: 'Google ID', key: 'googleId' },
                          { label: 'Apple ID', key: 'appleId' },
                          { label: 'Share profile ID', key: 'shareProfileId' },
                          { label: 'Selected country', key: 'selectedLocation' },
                          { label: 'Default country', key: 'locationDefault' },
                          { label: 'Android push token', key: 'fbPushToken' },
                          { label: 'iOS push token', key: 'iosToken' },
                          { label: 'Credits', key: 'credits' },
                        ] as { label: string; key: EditableTextField }[]
                      ).map((entry) => {
                        const isLocationField =
                          entry.key === 'selectedLocation' || entry.key === 'locationDefault';
                        return (
                          <label key={entry.key} style={labelStyle}>
                            {entry.label}
                            {isLocationField ? (
                              <select
                                style={selectStyle}
                                value={editFormState[entry.key]}
                                onChange={handleEditSelectChange(entry.key)}
                              >
                                <option value="">Not selected</option>
                                {locationOptions.map((location) => (
                                  <option key={location} value={location}>
                                    {location}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={entry.key === 'credits' ? 'number' : 'text'}
                                style={filterInputStyle}
                                value={editFormState[entry.key]}
                                onChange={handleEditTextChange(entry.key)}
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>
                    <div style={editCheckboxRowStyle}>
                      {(
                        [
                          { label: 'Premium', key: 'isPremium' },
                          { label: 'Active', key: 'isActive' },
                          { label: 'Onboarding', key: 'onboardingPass' },
                          { label: 'Secret onboarding', key: 'secretOnboardingPass' },
                        ] as { label: string; key: EditableBooleanField }[]
                      ).map((entry) => (
                        <label key={entry.key} style={checkboxLabelStyle}>
                          <input
                            type="checkbox"
                            style={checkboxInputStyle}
                            checked={editFormState[entry.key]}
                            onChange={handleEditCheckboxChange(entry.key)}
                          />
                          {entry.label}
                        </label>
                      ))}
                    </div>
                    <div style={{ ...buttonRowStyle, padding: 0 }}>
                      <button type="submit" style={buttonStyle} disabled={updateState.saving}>
                        {updateState.saving ? 'Saving...' : 'Save changes'}
                      </button>
                      {updateState.error && <span style={{ color: '#dc2626' }}>{updateState.error}</span>}
                      {updateState.success && <span style={{ color: '#059669' }}>{updateState.success}</span>}
                    </div>
                  </form>
                </section>

                <section style={detailCardStyle}>
                  <h3 style={sectionTitleStyle}>General information</h3>
                  <InfoCardGrid
                    groups={[
                      {
                        title: 'Profile',
                        fields: [
                          { label: 'First name', value: selectedUser.firstName ?? '—' },
                          { label: 'Last name', value: selectedUser.lastName ?? '—' },
                          { label: 'Username', value: selectedUser.username ?? '—' },
                          { label: 'Email', value: selectedUser.email ?? '—' },
                          { label: 'Language', value: selectedUser.lang ?? '—' },
                          { label: 'Platform', value: selectedUser.platformType ?? '—' },
                          { label: 'Auth type', value: selectedUser.authType ?? '—' },
                        ],
                      },
                      {
                        title: 'Location',
                        fields: [
                          { label: 'Default country', value: selectedUser.locationDefault ?? '—' },
                          { label: 'Selected country', value: selectedUser.selectedLocation ?? '—' },
                        ],
                      },
                      {
                        title: 'Status',
                        fields: [
                          { label: 'Premium', value: formatBoolean(selectedUser.isPremium) },
                          { label: 'Active', value: formatBoolean(selectedUser.isActive) },
                          { label: 'Onboarding', value: formatBoolean(selectedUser.onboardingPass) },
                          { label: 'Secret onboarding', value: formatBoolean(selectedUser.secretOnboardingPass) },
                        ],
                      },
                      {
                        title: 'Activity',
                        fields: [
                          { label: 'Credits', value: selectedUser.credits },
                          { label: 'Last login', value: formatDateTime(selectedUser.lastLoginAt) },
                          { label: 'Created', value: formatDateTime(selectedUser.createdAt) },
                        ],
                      },
                      {
                        title: 'Identifiers',
                        fields: [
                          { label: 'Telegram ID', value: selectedUser.telegramId ?? '—' },
                          { label: 'Google ID', value: selectedUser.googleId ?? '—' },
                          { label: 'Apple ID', value: selectedUser.appleId ?? '—' },
                          { label: 'Share profile ID', value: selectedUser.shareProfileId ?? '—' },
                        ],
                      },
                      {
                        title: 'Push tokens',
                        fields: [
                          { label: 'Android push', value: selectedUser.fbPushToken ?? '—' },
                          { label: 'iOS push', value: selectedUser.iosToken ?? '—' },
                        ],
                      },
                    ]}
                  />
                </section>

                <section style={detailCardStyle}>
                  <h3 style={sectionTitleStyle}>Send a message</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={detailValueStyle}>User platform: {selectedUser.platformType ?? '—'}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {channelKeys.map((channel) => {
                        const channelState = channelInfo[channel];
                        const channelDescription =
                          channelState.available || channelState.reason
                            ? channelState.reason ?? 'Ready to send'
                            : 'Channel unavailable';
                        return (
                          <div key={channel} style={messageChannelRowStyle}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{ fontWeight: 600 }}>{channelLabels[channel]}</span>
                              <span style={detailLabelStyle}>{channelDescription}</span>
                            </div>
                            <span style={messageBadgeStyle(channelState.available)}>
                              {channelState.available ? 'Available' : 'Unavailable'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <label style={labelStyle}>
                      Message
                      <textarea
                        style={messageTextareaStyle}
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        placeholder="Write a message to the user"
                      />
                    </label>
                    <div style={messageFooterStyle}>
                      <button
                        type="button"
                        style={buttonStyle}
                        disabled={messageStatus === 'sending' || messageStatus === 'loading'}
                        onClick={handleSendMessage}
                      >
                        {messageStatus === 'sending' ? 'Sending...' : 'Send message'}
                      </button>
                      {messageNotice && <span style={messageStatusTextStyle('#059669')}>{messageNotice}</span>}
                      {messageError && <span style={messageStatusTextStyle('#dc2626')}>{messageError}</span>}
                      {messageStatus === 'loading' && !messageError && (
                        <span style={messageStatusTextStyle('#6b7280')}>Refreshing channels...</span>
                      )}
                    </div>
                    {messageResults && messageResults.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <span style={detailLabelStyle}>Delivery result:</span>
                        {messageResults.map((result) => (
                          <div key={result.channel} style={messageChannelRowStyle}>
                            <div style={{ fontWeight: 600 }}>{channelLabels[result.channel]}</div>
                            <span style={messageBadgeStyle(result.sent)}>
                              {result.sent ? 'Sent' : 'Error'}
                            </span>
                            {!result.sent && result.error && (
                              <span style={detailLabelStyle}>{result.error}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <div style={inlineSectionsContainerStyle}>
                <section style={inlineSectionCardStyle}>
                  <h3 style={sectionTitleStyle}>Stats</h3>
                  <InfoFieldList
                    fields={[
                      { label: 'Following', value: selectedUser.stats.following },
                      { label: 'Followers', value: selectedUser.stats.followers },
                      { label: 'Wishlist', value: selectedUser.stats.wishlist },
                    ]}
                  />
                </section>

                <section style={inlineSectionCardStyle}>
                  <h3 style={sectionTitleStyle}>Settings</h3>
                  <InfoFieldList
                    fields={Object.entries(selectedUser.settings).map(([label, value]) => ({
                      label,
                      value: formatBoolean(Boolean(value)),
                    }))}
                  />
                </section>

                <section style={inlineSectionCardStyle}>
                  <h3 style={sectionTitleStyle}>Preferences</h3>
                  <InfoFieldList
                    fields={[
                      { label: 'Bio', value: selectedUser.preferences.bio ?? '—' },
                      {
                        label: 'Hobbies',
                        value: selectedUser.preferences.hobbies.length
                          ? selectedUser.preferences.hobbies.join(', ')
                          : '—',
                      },
                      {
                        label: 'Favorite colors',
                        value: selectedUser.preferences.favoriteColors.length
                          ? selectedUser.preferences.favoriteColors.join(', ')
                          : '—',
                      },
                      {
                        label: 'Food',
                        value: selectedUser.preferences.foodPreferences.length
                          ? selectedUser.preferences.foodPreferences.join(', ')
                          : '—',
                      },
                      {
                        label: 'Tech',
                        value: selectedUser.preferences.techPreferences.length
                          ? selectedUser.preferences.techPreferences.join(', ')
                          : '—',
                      },
                      {
                        label: 'Wishlist vibes',
                        value: selectedUser.preferences.wishlistVibes.length
                          ? selectedUser.preferences.wishlistVibes.join(', ')
                          : '—',
                      },
                      {
                        label: 'Style & Sizes',
                        value:
                          selectedUser.preferences.styleAndSizes &&
                          Object.keys(selectedUser.preferences.styleAndSizes).length ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {Object.entries(selectedUser.preferences.styleAndSizes).map(([key, value]) => (
                                <span
                                  key={key}
                                  style={{
                                    padding: '6px 10px',
                                    borderRadius: '999px',
                                    background: '#FDF6F5',
                                    fontSize: '12px',
                                    color: '#4338ca',
                                  }}
                                >
                                  {key}: {value}
                                </span>
                              ))}
                            </div>
                          ) : (
                            '—'
                          ),
                      },
                    ]}
                  />
                </section>
              </div>

              <section style={sectionWrapperStyle}>
                <h3 style={sectionTitleStyle}>Following</h3>
                <div style={listContainerStyle}>
                  {selectedUser.following.length === 0 && <div style={listEmptyStyle}>No following yet.</div>}
                  {selectedUser.following.map((user) => (
                    <div key={user.id} style={listItemStyle}>
                      <div style={listItemTitleStyle}>{user.fullName ?? user.username ?? '—'}</div>
                      <div style={listItemMetaStyle}>
                        {user.email ?? '—'} · {user.platformType ?? '—'} · {user.lang ?? '—'}
                      </div>
                      <div style={listItemMetaStyle}>Created: {formatDateTime(user.createdAt)}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={sectionWrapperStyle}>
                <h3 style={sectionTitleStyle}>Followers</h3>
                <div style={listContainerStyle}>
                  {selectedUser.followers.length === 0 && <div style={listEmptyStyle}>No followers yet.</div>}
                  {selectedUser.followers.map((user) => (
                    <div key={user.id} style={listItemStyle}>
                      <div style={listItemTitleStyle}>{user.fullName ?? user.username ?? '—'}</div>
                      <div style={listItemMetaStyle}>
                        {user.email ?? '—'} · {user.platformType ?? '—'} · {user.lang ?? '—'}
                      </div>
                      <div style={listItemMetaStyle}>Created: {formatDateTime(user.createdAt)}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={sectionWrapperStyle}>
                <h3 style={sectionTitleStyle}>Surveys</h3>
                {selectedUser.surveys.length === 0 ? (
                  <div style={listEmptyStyle}>The user has not completed any surveys yet.</div>
                ) : (
                  <>
                    <div style={tableWrapperStyle}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Title</th>
                            <th style={thStyle}>Created</th>
                            <th style={thStyle}>Steps</th>
                            <th style={thStyle}>Results</th>
                            <th style={thStyle}>Results unlocked</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedUser.surveys.map((survey) => {
                            const isLoading =
                              surveyDetailsState.loading && surveyDetailsState.surveyId === survey.id;
                            return (
                              <tr key={survey.id}>
                                <td style={tdStyle}>{survey.title ?? 'Untitled'}</td>
                                <td style={tdStyle}>{formatDateTime(survey.createdAt)}</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>{survey.stepsCount}</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>{survey.resultsCount}</td>
                                <td style={tdStyle}>{formatBoolean(survey.resultUnlocked)}</td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    style={{ ...secondaryButtonStyle, padding: '6px 10px', fontSize: '12px' }}
                                    onClick={() => handleLoadSurveyDetails(survey.id)}
                                    disabled={isLoading}
                                  >
                                    {isLoading ? 'Loading...' : 'Details'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {renderSurveyDetailsCard()}
                  </>
                )}
              </section>

              <section style={sectionWrapperStyle}>
                <h3 style={sectionTitleStyle}>Wishlist</h3>
                <div style={listContainerStyle}>
                  {selectedUser.wishlist.length === 0 && <div style={listEmptyStyle}>Wishlist is empty.</div>}
                  {selectedUser.wishlist.map((wish) => (
                    <div key={wish.id} style={listItemStyle}>
                      <div style={listItemTitleStyle}>{wish.title}</div>
                      <div style={listItemMetaStyle}>
                        Source: {wish.source ?? '—'} · Booked: {formatBoolean(wish.isBooked)} · Created: {formatDateTime(wish.createdAt)}
                      </div>
                      {wish.link && <OpenLinkButton href={wish.link} />}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      </CollapsibleCard>
    </div>
  );
};

export default UserExplorer;
