import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AdminJSGlobalBase } from '../adminjs-global';
import {
  buttonRowStyle,
  buttonStyle,
  cardContentStyle,
  checkboxInputStyle,
  filterInputStyle,
  headingStyle,
  pageWrapperStyle,
  secondaryButtonStyle,
  subHeadingStyle,
  tableStyle,
  tableWrapperStyle,
  tdStyle,
  thStyle,
} from '../table-styles';
import { CollapsibleCard } from '../collapsible-card';
import { AccessDeniedMessage } from '../access-denied-message';
import { ACCESS_DENIED_MESSAGE, isAccessDeniedError } from '../access-control.utils';
import {
  type SupportedLanguage,
} from '../../../../common/i18n/supported-languages';
import { adminTranslate } from '../../utils/admin-i18n';
import { ADMIN_LANGUAGES, normalizeAdminLanguage } from '../../utils/admin-language';

type AdminAccessPage = {
  key: string;
  label: string;
  description: string | null;
  groupId: string;
};

type AdminAccessRule = {
  pageKey: string;
  type: 'view' | 'edit';
};

type AdminAccessUser = {
  id: string;
  name: string;
  login: string;
  isSuper: boolean;
  createdAt: string;
  rules: AdminAccessRule[];
  language: SupportedLanguage;
};

type AdminAccessTotals = {
  totalAdmins: number;
  superAdmins: number;
  managedPages: number;
  permissionLinks: number;
};

type AdminAccessMetadataResponse = {
  success: true;
  type: 'metadata';
  generatedAt: string;
  pages: AdminAccessPage[];
  users: AdminAccessUser[];
  totals: AdminAccessTotals;
  languages: SupportedLanguage[];
};

type AdminAccessMutationResponse = {
  success: true;
  type: 'mutation';
  user: AdminAccessUser;
  message: string;
};

type AdminAccessErrorResponse = {
  success: false;
  message: string;
  details?: string[];
};

type AdminAccessResponse =
  | AdminAccessMetadataResponse
  | AdminAccessMutationResponse
  | AdminAccessErrorResponse;

type AdminJSApiClient = {
  getPage: <T = unknown>(options: {
    pageName: string;
    method?: 'get' | 'post';
    data?: any;
  }) => Promise<{ data?: T } | null>;
};

type AdminJSGlobal = AdminJSGlobalBase<AdminJSApiClient>;

type PermissionEntry = {
  view: boolean;
  edit: boolean;
};

type FormState = {
  name: string;
  login: string;
  password: string;
  confirmPassword: string;
  isSuper: boolean;
  language: SupportedLanguage;
};

const NEW_USER_ID = '__new__';

const statsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
};

const statCardStyle: React.CSSProperties = {
  borderRadius: '16px',
  border: '1px solid #f1f5f9',
  padding: '14px 16px',
  background: '#f8fafc',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
};

const statValueStyle: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#111827',
};

const layoutGridStyle: React.CSSProperties = {
  display: 'grid',
  gap: '18px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  alignItems: 'flex-start',
};

const userListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const userButtonStyle: React.CSSProperties = {
  borderRadius: '14px',
  border: '1px solid #e5e7eb',
  padding: '12px',
  background: '#fff',
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  cursor: 'pointer',
  textAlign: 'left',
};

const userButtonActiveStyle: React.CSSProperties = {
  borderColor: '#ec4899',
  boxShadow: '0 4px 14px rgba(236, 72, 153, 0.25)',
};

const userMetaStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
};

const badgeStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  padding: '3px 8px',
  borderRadius: '10px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
};

const superBadgeStyle: React.CSSProperties = {
  ...badgeStyle,
  background: '#dcfce7',
  color: '#15803d',
};

const defaultBadgeStyle: React.CSSProperties = {
  ...badgeStyle,
  background: '#eef2ff',
  color: '#3730a3',
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
};

const formFieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
};

const formInputStyle: React.CSSProperties = {
  ...filterInputStyle,
  width: '100%',
  borderRadius: '10px',
  padding: '10px 12px',
  fontSize: '14px',
};

const helperTextStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
};

const formSectionTitleStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  margin: '12px 0 6px',
};

const permissionCellStyle: React.CSSProperties = {
  ...tdStyle,
  verticalAlign: 'middle',
};

const statusBannerStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: '12px',
  fontSize: '13px',
};

const statusSuccessStyle: React.CSSProperties = {
  ...statusBannerStyle,
  background: '#ecfccb',
  color: '#365314',
};

const statusErrorStyle: React.CSSProperties = {
  ...statusBannerStyle,
  background: '#fee2e2',
  color: '#991b1b',
};

const emptyStateStyle: React.CSSProperties = {
  padding: '12px',
  fontSize: '13px',
  color: '#6b7280',
  borderRadius: '12px',
  background: '#f8fafc',
  border: '1px dashed #cbd5f5',
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '13px',
  color: '#111827',
};

const AdminAccessManager: React.FC = () => {
  const [accessDenied, setAccessDenied] = useState(false);
  const t = useCallback((path: string) => adminTranslate(`adminAccess.${path}`), []);
  const resolveCurrentLanguage = useCallback(() => {
    const adminGlobal = window.AdminJS as AdminJSGlobal | undefined;
    const preferredLanguage =
      adminGlobal?.user?.language ||
      adminGlobal?.user?.locale?.language ||
      adminGlobal?.locale?.language ||
      (typeof navigator !== 'undefined' ? navigator.language : null);
    return normalizeAdminLanguage(preferredLanguage);
  }, []);
  const [pages, setPages] = useState<AdminAccessPage[]>([]);
  const [users, setUsers] = useState<AdminAccessUser[]>([]);
  const [totals, setTotals] = useState<AdminAccessTotals>({
    totalAdmins: 0,
    superAdmins: 0,
    managedPages: 0,
    permissionLinks: 0,
  });
  const [languages, setLanguages] = useState<SupportedLanguage[]>([
    ...ADMIN_LANGUAGES,
  ]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [permissionState, setPermissionState] = useState<
    Record<string, PermissionEntry>
  >({});
  const [formState, setFormState] = useState<FormState>({
    name: '',
    login: '',
    password: '',
    confirmPassword: '',
    isSuper: false,
    language: ADMIN_LANGUAGES[0],
  });
  const [actionStatus, setActionStatus] = useState<
    'idle' | 'saving' | 'success' | 'error'
  >('idle');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const createEmptyPermissions = useCallback(() => {
    return pages.reduce<Record<string, PermissionEntry>>((acc, page) => {
      acc[page.key] = acc[page.key] ?? { view: false, edit: false };
      return acc;
    }, {});
  }, [pages]);

  const buildPermissionsFromUser = useCallback(
    (user?: AdminAccessUser | null) => {
      const base = createEmptyPermissions();
      if (!user) {
        return base;
      }
      user.rules.forEach((rule) => {
        if (!base[rule.pageKey]) {
          return;
        }
        if (rule.type === 'view') {
          base[rule.pageKey].view = true;
        }
        if (rule.type === 'edit') {
          base[rule.pageKey].edit = true;
          base[rule.pageKey].view = true;
        }
      });
      return base;
    },
    [createEmptyPermissions],
  );

  const recomputeTotals = useCallback(
    (nextUsers: AdminAccessUser[]) => {
      setTotals({
        totalAdmins: nextUsers.length,
        superAdmins: nextUsers.filter((user) => user.isSuper).length,
        managedPages: pages.length,
        permissionLinks: nextUsers.reduce(
          (acc, user) => acc + (user.rules?.length ?? 0),
          0,
        ),
      });
    },
    [pages.length],
  );

  const getApiClient = useCallback(() => {
    const adminGlobal = window.AdminJS as AdminJSGlobal | undefined;
    const ApiClient = adminGlobal?.ApiClient;
    if (!ApiClient) {
      throw new Error(t('errors.apiClientUnavailable'));
    }
    return new ApiClient();
  }, [t]);

  const fetchMetadata = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const apiClient = getApiClient();
      const response = await apiClient.getPage<AdminAccessResponse>({
        pageName: 'adminAccess',
        method: 'get',
      });
      const payload = response?.data;
      if (!payload) {
        throw new Error(t('errors.fetchFailed'));
      }
      if (payload.success === false || payload.type !== 'metadata') {
        const message =
          payload.success === false
            ? payload.message
            : t('errors.fetchFailed');
        throw new Error(message);
      }
      setPages(payload.pages);
      setUsers(payload.users);
      setLanguages(payload.languages ?? [...ADMIN_LANGUAGES]);
      setTotals(payload.totals);
      setGeneratedAt(payload.generatedAt);
      setSelectedUserId((current) => {
        if (!payload.users.length) {
          return NEW_USER_ID;
        }
        if (!current || current === NEW_USER_ID) {
          return payload.users[0].id;
        }
        return payload.users.some((user) => user.id === current)
          ? current
          : payload.users[0].id;
      });
    } catch (error) {
      const forbidden = isAccessDeniedError(error);
      if (forbidden) {
        setAccessDenied(true);
      }
      const message =
        forbidden
          ? ACCESS_DENIED_MESSAGE
          : error instanceof Error
            ? error.message
            : t('errors.fetchFailed');
      setFetchError(message);
      setPages([]);
      setUsers([]);
      setLanguages([...ADMIN_LANGUAGES]);
      setTotals({
        totalAdmins: 0,
        superAdmins: 0,
        managedPages: 0,
        permissionLinks: 0,
      });
      setGeneratedAt(null);
      setSelectedUserId(NEW_USER_ID);
    } finally {
      setLoading(false);
    }
  }, [getApiClient]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  useEffect(() => {
    if (!selectedUserId) {
      if (users.length) {
        setSelectedUserId(users[0].id);
      } else {
        setSelectedUserId(NEW_USER_ID);
      }
    }
  }, [selectedUserId, users]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const isCreatingNew = !selectedUser || selectedUserId === NEW_USER_ID;

  useEffect(() => {
    if (!pages.length) {
      setPermissionState({});
      return;
    }
    if (isCreatingNew) {
      setPermissionState(createEmptyPermissions());
      setFormState({
        name: '',
        login: '',
        password: '',
        confirmPassword: '',
        isSuper: false,
        language: languages[0] ?? ADMIN_LANGUAGES[0],
      });
      return;
    }
    setPermissionState(buildPermissionsFromUser(selectedUser));
    setFormState({
      name: selectedUser?.name ?? '',
      login: selectedUser?.login ?? '',
      password: '',
      confirmPassword: '',
      isSuper: Boolean(selectedUser?.isSuper),
      language: selectedUser?.language ?? languages[0] ?? ADMIN_LANGUAGES[0],
    });
  }, [
    buildPermissionsFromUser,
    createEmptyPermissions,
    isCreatingNew,
    pages,
    selectedUser,
    languages,
  ]);

  useEffect(() => {
    if (!formState.isSuper) {
      return;
    }
    setPermissionState((prev) => {
      const updated = createEmptyPermissions();
      Object.keys(updated).forEach((pageKey) => {
        updated[pageKey] = { view: true, edit: true };
      });
      return updated;
    });
  }, [createEmptyPermissions, formState.isSuper]);

  useEffect(() => {
    setActionMessage(null);
    setActionError(null);
    setActionStatus('idle');
  }, [selectedUserId]);

  const handleInputChange = (field: keyof FormState) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        event.target.type === 'checkbox'
          ? event.target.checked
          : event.target.value;
      setFormState((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handlePermissionToggle = (
    pageKey: string,
    type: keyof PermissionEntry,
  ) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    setPermissionState((prev) => {
      const next = { ...prev };
      const current = { view: false, edit: false, ...(prev[pageKey] ?? {}) };
      if (type === 'edit') {
        current.edit = checked;
        if (checked) {
          current.view = true;
        }
      } else {
        current.view = checked;
        if (!checked) {
          current.edit = false;
        }
      }
      next[pageKey] = current;
      return next;
    });
  };

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      if (a.isSuper && !b.isSuper) return -1;
      if (!a.isSuper && b.isSuper) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [users]);

  const permissionRows = useMemo(() => {
    return pages.map((page) => ({
      page,
      state: permissionState[page.key] ?? { view: false, edit: false },
    }));
  }, [pages, permissionState]);

  const formatDate = (value?: string | null) => {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    const dateLocale = resolveCurrentLanguage() === 'ru' ? 'ru-RU' : 'en-US';
    return date.toLocaleString(dateLocale);
  };

  const passwordMismatch =
    formState.password.trim() &&
    formState.confirmPassword.trim() &&
    formState.password.trim() !== formState.confirmPassword.trim();

  const passwordTooShort =
    (isCreatingNew || formState.password.trim()) &&
    formState.password.trim().length > 0 &&
    formState.password.trim().length < 8;

  const canSubmit = Boolean(
    formState.name.trim() &&
      formState.login.trim() &&
      !passwordMismatch &&
      !passwordTooShort &&
      (!isCreatingNew || formState.password.trim().length >= 8),
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setActionMessage(null);
    setActionError(null);
    if (!canSubmit) {
      setActionError(t('errors.requiredFields'));
      return;
    }
    if (passwordMismatch) {
      setActionError(t('errors.passwordMismatch'));
      return;
    }
    setActionStatus('saving');
    try {
      const apiClient = getApiClient();
      const payload = {
        action: isCreatingNew ? 'create' : 'update',
        userId: isCreatingNew ? undefined : selectedUser?.id,
        name: formState.name.trim(),
        login: formState.login.trim(),
        password: formState.password.trim(),
        isSuper: formState.isSuper,
        language: formState.language,
        permissions: Object.entries(permissionState).map(
          ([pageKey, state]) => ({
            pageKey,
            view: state.view,
            edit: state.edit,
          }),
        ),
      };
      const response = await apiClient.getPage<AdminAccessResponse>({
        pageName: 'adminAccess',
        method: 'post',
        data: payload,
      });
      const data = response?.data;
      if (!data) {
        throw new Error(t('errors.saveFailed'));
      }
      if (data.success === false || data.type !== 'mutation') {
        const message =
          data.success === false
            ? data.message
            : t('errors.saveFailed');
        throw new Error(message);
      }
      setActionStatus('success');
      setActionMessage(data.message);
      setActionError(null);
      setFormState((prev) => ({
        ...prev,
        password: '',
        confirmPassword: '',
      }));
      setUsers((prev) => {
        const existingIndex = prev.findIndex((user) => user.id === data.user.id);
        if (existingIndex === -1) {
          const next = [...prev, data.user];
          recomputeTotals(next);
          return next;
        }
        const next = [...prev];
        next[existingIndex] = data.user;
        recomputeTotals(next);
        return next;
      });
      setSelectedUserId(data.user.id);
    } catch (error) {
      const forbidden = isAccessDeniedError(error);
      if (forbidden) {
        setAccessDenied(true);
      }
      const message =
        forbidden
          ? ACCESS_DENIED_MESSAGE
          : error instanceof Error
            ? error.message
            : t('errors.saveFailed');
      setActionStatus('error');
      setActionError(message);
    }
  };

  if (accessDenied) {
    return <AccessDeniedMessage />;
  }

  return (
    <div style={pageWrapperStyle}>
      <CollapsibleCard>
        <div style={cardContentStyle}>
          <h1 style={headingStyle}>{t('title')}</h1>
          <p style={subHeadingStyle}>
            {t('description')}
          </p>
          <div style={statsGridStyle}>
            <div style={statCardStyle}>
              <span style={statLabelStyle}>{t('stats.totalAdmins')}</span>
              <span style={statValueStyle}>{totals.totalAdmins}</span>
            </div>
            <div style={statCardStyle}>
              <span style={statLabelStyle}>{t('stats.superAdmins')}</span>
              <span style={statValueStyle}>{totals.superAdmins}</span>
            </div>
            <div style={statCardStyle}>
              <span style={statLabelStyle}>{t('stats.managedPages')}</span>
              <span style={statValueStyle}>{totals.managedPages}</span>
            </div>
            <div style={statCardStyle}>
              <span style={statLabelStyle}>{t('stats.permissionLinks')}</span>
              <span style={statValueStyle}>{totals.permissionLinks}</span>
            </div>
          </div>
          <div style={buttonRowStyle}>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => setSelectedUserId(NEW_USER_ID)}
            >
              {t('actions.newAdmin')}
            </button>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={fetchMetadata}
              disabled={loading}
            >
              {t('actions.refresh')}
            </button>
            {generatedAt && (
              <span style={helperTextStyle}>
                {t('meta.syncedAt')}: {formatDate(generatedAt)}
              </span>
            )}
          </div>
          {fetchError && <div style={statusErrorStyle}>{fetchError}</div>}
        </div>
      </CollapsibleCard>

      <div style={layoutGridStyle}>
        <CollapsibleCard>
          <div style={cardContentStyle}>
            <h2 style={subHeadingStyle}>{t('sections.admins')}</h2>
            {loading ? (
              <p style={helperTextStyle}>{t('states.loading')}</p>
            ) : sortedUsers.length === 0 ? (
              <p style={emptyStateStyle}>
                {t('states.emptyAdmins')}
              </p>
            ) : (
              <div style={userListStyle}>
                {sortedUsers.map((user) => {
                  const isActive = user.id === selectedUserId;
                  const viewRules = user.rules.filter((rule) => rule.type === 'view')
                    .length;
                  const editRules = user.rules.filter((rule) => rule.type === 'edit')
                    .length;
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(user.id)}
                      style={{
                        ...userButtonStyle,
                        ...(isActive ? userButtonActiveStyle : {}),
                      }}
                    >
                      <strong>{user.name}</strong>
                      <span style={helperTextStyle}>{user.login}</span>
                      <div style={userMetaStyle}>
                        <span>{t('meta.createdAt')}: {formatDate(user.createdAt)}</span>
                        <span>{t('meta.view')}: {viewRules}</span>
                        <span>{t('meta.edit')}: {editRules}</span>
                        <span>{t('meta.language')}: {user.language.toUpperCase()}</span>
                      </div>
                      <div>
                        {user.isSuper ? (
                          <span style={superBadgeStyle}>{t('badges.super')}</span>
                        ) : (
                          <span style={defaultBadgeStyle}>{t('badges.standard')}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </CollapsibleCard>

        <CollapsibleCard>
          <div style={cardContentStyle}>
            <h2 style={subHeadingStyle}>
              {isCreatingNew
                ? t('sections.newAdmin')
                : `${t('sections.editAdmin')} — ${selectedUser?.name ?? ''}`}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={formGridStyle}>
                <label style={formFieldStyle}>
                  <span>{t('form.name')}</span>
                  <input
                    style={formInputStyle}
                    type="text"
                    value={formState.name}
                    onChange={handleInputChange('name')}
                    placeholder={t('placeholders.name')}
                    required
                  />
                </label>
                <label style={formFieldStyle}>
                  <span>{t('form.login')}</span>
                  <input
                    style={formInputStyle}
                    type="email"
                    value={formState.login}
                    onChange={handleInputChange('login')}
                    placeholder={t('placeholders.login')}
                    required
                  />
                  <span style={helperTextStyle}>
                    {t('helper.login')}
                  </span>
                </label>
                <label style={formFieldStyle}>
                  <span>{t('form.language')}</span>
                  <select
                    style={{ ...formInputStyle, appearance: 'auto' }}
                    value={formState.language}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        language: event.target.value as SupportedLanguage,
                      }))
                    }
                  >
                    {languages.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <span style={helperTextStyle}>
                    {t('helper.language')}
                  </span>
                </label>
                <label style={formFieldStyle}>
                  <span>
                    {isCreatingNew ? t('form.password') : t('form.passwordOptional')}
                  </span>
                  <input
                    style={formInputStyle}
                    type="password"
                    value={formState.password}
                    onChange={handleInputChange('password')}
                    placeholder={
                      isCreatingNew
                        ? t('placeholders.passwordNew')
                        : t('placeholders.passwordEdit')
                    }
                  />
                </label>
                <label style={formFieldStyle}>
                  <span>{t('form.confirmPassword')}</span>
                  <input
                    style={formInputStyle}
                    type="password"
                    value={formState.confirmPassword}
                    onChange={handleInputChange('confirmPassword')}
                    placeholder={t('placeholders.confirmPassword')}
                  />
                </label>
              </div>

              <label style={{ ...checkboxLabelStyle, marginTop: '12px' }}>
                <input
                  type="checkbox"
                  checked={formState.isSuper}
                  onChange={handleInputChange('isSuper')}
                  style={checkboxInputStyle}
                />
                {t('form.superAdmin')}
              </label>

              {passwordMismatch && (
                <div style={statusErrorStyle}>{t('errors.passwordMismatch')}</div>
              )}
              {passwordTooShort && (
                <div style={statusErrorStyle}>{t('errors.passwordTooShort')}</div>
              )}

              <h3 style={formSectionTitleStyle}>{t('sections.permissions')}</h3>
              {pages.length === 0 ? (
                <p style={helperTextStyle}>{t('states.noPages')}</p>
              ) : (
                <div style={tableWrapperStyle}>
                  <table style={{ ...tableStyle, minWidth: '100%' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>{t('table.page')}</th>
                        <th style={thStyle}>{t('table.view')}</th>
                        <th style={thStyle}>{t('table.edit')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permissionRows.map(({ page, state }) => (
                        <tr key={page.key}>
                          <td style={permissionCellStyle}>
                            <strong>{page.label}</strong>
                            {page.description && (
                              <p style={helperTextStyle}>{page.description}</p>
                            )}
                          </td>
                          <td style={permissionCellStyle}>
                            <label style={checkboxLabelStyle}>
                              <input
                                type="checkbox"
                                checked={state.view}
                                disabled={formState.isSuper}
                                onChange={handlePermissionToggle(page.key, 'view')}
                                style={checkboxInputStyle}
                              />
                              {t('table.view')}
                            </label>
                          </td>
                          <td style={permissionCellStyle}>
                            <label style={checkboxLabelStyle}>
                              <input
                                type="checkbox"
                                checked={state.edit}
                                disabled={formState.isSuper}
                                onChange={handlePermissionToggle(page.key, 'edit')}
                                style={checkboxInputStyle}
                              />
                              {t('table.edit')}
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={{ ...buttonRowStyle, marginTop: '16px' }}>
                <button
                  type="submit"
                  style={buttonStyle}
                  disabled={!canSubmit || actionStatus === 'saving'}
                >
                  {actionStatus === 'saving'
                    ? t('actions.saving')
                    : t('actions.save')}
                </button>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() =>
                    setSelectedUserId((current) =>
                      current === NEW_USER_ID && users.length
                        ? users[0].id
                        : NEW_USER_ID,
                    )
                  }
                >
                  {t('actions.clearForm')}
                </button>
              </div>
            </form>

            {actionMessage && <div style={statusSuccessStyle}>{actionMessage}</div>}
            {actionError && <div style={statusErrorStyle}>{actionError}</div>}
          </div>
        </CollapsibleCard>
      </div>
    </div>
  );
};

export default AdminAccessManager;
