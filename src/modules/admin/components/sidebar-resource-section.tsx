import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router';

import {
  COMPONENT_GROUPS,
  type ComponentGroupDefinition,
  type ComponentGroupId,
} from '../config/component-groups';
import { buildAdminPageUrl } from '../utils/admin-page-url';
import type { AdminSession } from '../types/admin.types';

const sidebarWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
};

const sectionStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '10px',
  border: '1px solid #e2e8f0',
  padding: '16px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: 600,
  marginBottom: '12px',
};

const tabButtonStyle: React.CSSProperties = {
  borderRadius: '999px',
  border: '1px solid #E98A98',
  cursor: 'pointer',
  padding: '8px 18px',
  fontSize: '13px',
  fontWeight: 600,
  backgroundColor: 'transparent',
  color: '#E98A98',
  transition: 'background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
};

const tabButtonActiveStyle: React.CSSProperties = {
  ...tabButtonStyle,
  backgroundColor: '#E98A98',
  color: '#fff',
  boxShadow: '0 10px 24px rgba(233, 138, 152, 0.3)',
};

const tabsWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginBottom: '12px',
};

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
};

const listItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 16px',
  borderRadius: '12px',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: 500,
  color: '#1a202c',
  border: '1px solid #f3d0d6',
  transition: 'background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
};

const listItemSelectedStyle: React.CSSProperties = {
  ...listItemStyle,
  backgroundColor: '#E98A98',
  color: '#fff',
  boxShadow: '0 10px 24px rgba(233, 138, 152, 0.3)',
};

const dividerStyle: React.CSSProperties = {
  height: '1px',
  width: '100%',
  backgroundColor: '#e5e7eb',
  margin: '0 0 12px',
};

type TranslateFunction = (key: string, resourceId?: string) => string;

type AdminGlobalLike = {
  translateLabel?: TranslateFunction;
  i18n?: {
    translateLabel?: TranslateFunction;
  };
};

type ResourceNavigationInfo = {
  name: string | null;
  icon?: string | null;
  show?: boolean;
};

type ResourceJSONLike = {
  id: string;
  name: string;
  href: string | null;
  navigation?: ResourceNavigationInfo | null;
};

type SidebarResourceSectionProps = {
  resources: ResourceJSONLike[];
};

type AdminPageState = {
  name: string;
  icon?: string;
};

type AdminReduxState = {
  pages?: AdminPageState[];
  session?: AdminSession | null;
};

type NavigationItem = {
  id: string;
  label: string;
  href?: string;
  isSelected: boolean;
};

type PageGroup = ComponentGroupDefinition & {
  items: NavigationItem[];
};

const useAdminTranslateLabel = (): TranslateFunction => {
  return useMemo(() => {
    const adminGlobal = (typeof window !== 'undefined'
      ? (window.AdminJS as AdminGlobalLike | undefined)
      : undefined);

    const fallback: TranslateFunction = (key) => key;
    if (!adminGlobal) {
      return fallback;
    }

    const candidates: TranslateFunction[] = [];
    if (typeof adminGlobal.translateLabel === 'function') {
      candidates.push(adminGlobal.translateLabel);
    }
    if (typeof adminGlobal.i18n?.translateLabel === 'function') {
      candidates.push(adminGlobal.i18n.translateLabel);
    }

    if (candidates.length === 0) {
      return fallback;
    }

    return (key: string, resourceId?: string) => {
      for (const candidate of candidates) {
        try {
          const result = candidate(key, resourceId);
          if (result) {
            return result;
          }
        } catch {
        }
      }
      return fallback(key, resourceId);
    };
  }, []);
};

const buildPageNavigation = (
  group: ComponentGroupDefinition,
  pages: Map<string, AdminPageState>,
  locationPath: string,
  accessiblePages: Set<string> | null,
): NavigationItem[] => {
  return group.pages
    .map<NavigationItem | null>((page) => {
      if (accessiblePages && !accessiblePages.has(page.name)) {
        return null;
      }
      const state = pages.get(page.name);
      if (!state) {
        return null;
      }
      const href = buildAdminPageUrl(page.name);
      return {
        id: page.name,
        label: page.label,
        href,
        isSelected: locationPath.startsWith(href),
      };
    })
    .filter((item): item is NavigationItem => Boolean(item));
};

const SidebarResourceSection: React.FC<SidebarResourceSectionProps> = ({
  resources: _resources,
}) => {
  const translateLabel = useAdminTranslateLabel();
  const location = useLocation();
  const navigate = useNavigate();
  const pages = useSelector<AdminReduxState, AdminPageState[]>(
    (state) => state.pages ?? [],
  );
  const session = useSelector<AdminReduxState, AdminSession | null>(
    (state) => state.session ?? null,
  );
  const [activeGroupId, setActiveGroupId] = useState<ComponentGroupId | null>(null);

  const accessiblePages = useMemo(() => {
    if (!session || session.isSuper) {
      return null;
    }

    const allowed = new Set<string>();
    for (const permission of session.permissions ?? []) {
      if (permission?.pageKey && (permission.type === 'view' || permission.type === 'edit')) {
        allowed.add(permission.pageKey);
      }
    }
    return allowed;
  }, [session]);

  const groupedPages = useMemo<PageGroup[]>(() => {
    const pageMap = new Map<string, AdminPageState>();
    pages.forEach((page) => pageMap.set(page.name, page));

    return COMPONENT_GROUPS.map<PageGroup>((group) => ({
      ...group,
      items: buildPageNavigation(group, pageMap, location.pathname, accessiblePages),
    })).filter((group) => group.items.length > 0);
  }, [accessiblePages, location.pathname, pages]);

  useEffect(() => {
    if (!groupedPages.length) {
      if (activeGroupId !== null) {
        setActiveGroupId(null);
      }
      return;
    }

    if (!groupedPages.some((group) => group.id === activeGroupId)) {
      setActiveGroupId(groupedPages[0].id);
    }
  }, [activeGroupId, groupedPages]);

  const activeGroup =
    groupedPages.find((group) => group.id === activeGroupId) ?? groupedPages[0];

  const handleNavigation = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, href?: string) => {
      if (!href) {
        return;
      }
      event.preventDefault();
      navigate(href);
    },
    [navigate],
  );

  return (
    <div style={sidebarWrapperStyle}>
      <section style={sectionStyle}>
        <div style={sectionTitleStyle} aria-hidden="true">
          {' '}
        </div>
        {groupedPages.length > 0 ? (
          <>
            <div style={tabsWrapperStyle}>
              {groupedPages.map((group) => (
                <button
                  type="button"
                  key={group.id}
                  style={group.id === activeGroup?.id ? tabButtonActiveStyle : tabButtonStyle}
                  onClick={() => setActiveGroupId(group.id)}
                >
                  {group.label}
                </button>
              ))}
            </div>

            {activeGroup ? (
              <>
                <div style={dividerStyle} aria-hidden="true" />
                <ul style={listStyle}>
                  {activeGroup.items.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.href}
                        onClick={(event) => handleNavigation(event, item.href)}
                        style={item.isSelected ? listItemSelectedStyle : listItemStyle}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : (
          <div style={{ fontSize: '13px', color: '#718096' }}>No available pages.</div>
        )}
      </section>
    </div>
  );
};

export default SidebarResourceSection;
