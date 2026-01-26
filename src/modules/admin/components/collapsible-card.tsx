import React, { ElementType, useCallback, useMemo, useState } from 'react';
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react';
import { cardStyle } from './table-styles';

const toggleButtonStyle: CSSProperties = {
  position: 'absolute',
  top: '12px',
  right: '12px',
  width: '34px',
  height: '34px',
  borderRadius: '999px',
  border: '1px solid #E98A98',
  background: '#E98A98',
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: '0 12px 24px rgba(233, 138, 152, 0.35)',
  transition: 'background 0.2s ease, transform 0.2s ease',
  zIndex: 2,
};

const arrowIconStyle: CSSProperties = {
  display: 'inline-block',
  transition: 'transform 0.2s ease',
};

const collapsedNoticeStyle: CSSProperties = {
  padding: '16px 20px',
  color: '#9ca3af',
  fontSize: '13px',
};

type CollapsibleCardBaseProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  style?: CSSProperties;
  defaultCollapsed?: boolean;
  collapsedNotice?: ReactNode;
  contentWrapperStyle?: CSSProperties;
  collapsible?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, 'style' | 'children'>;

export const CollapsibleCard = <T extends ElementType = 'div'>({
  as,
  children,
  style,
  defaultCollapsed = false,
  collapsedNotice,
  contentWrapperStyle,
  collapsible = true,
  ...rest
}: CollapsibleCardBaseProps<T>) => {
  const Component = (as ?? 'div') as ElementType;
  const [isCollapsed, setIsCollapsed] = useState(
    collapsible ? defaultCollapsed : false,
  );

  const extractFirstText = useCallback((node: ReactNode): string | null => {
    if (node == null || typeof node === 'boolean') {
      return null;
    }

    if (typeof node === 'string') {
      const trimmed = node.trim();
      return trimmed.length ? trimmed : null;
    }

    if (typeof node === 'number') {
      return node.toString();
    }

    if (Array.isArray(node)) {
      for (const child of node) {
        const text = extractFirstText(child);
        if (text) {
          return text;
        }
      }
      return null;
    }

    if (React.isValidElement(node)) {
      return extractFirstText(node.props.children);
    }

    return null;
  }, []);

  const derivedCollapsedNotice = useMemo(() => {
    if (collapsedNotice) {
      return collapsedNotice;
    }

    return extractFirstText(children) ?? 'Card is collapsed';
  }, [collapsedNotice, children, extractFirstText]);

  const toggleCollapsed = useCallback(() => {
    if (!collapsible) {
      return;
    }

    setIsCollapsed((prev) => !prev);
  }, [collapsible]);

  const isContentCollapsed = collapsible ? isCollapsed : false;

  return (
    <Component
      {...(rest as ComponentPropsWithoutRef<T>)}
      style={{
        ...cardStyle,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {collapsible && (
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={
            isContentCollapsed ? 'Expand card' : 'Collapse card'
          }
          aria-expanded={!isContentCollapsed}
          style={{
            ...toggleButtonStyle,
            transform: isContentCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <span style={{ ...arrowIconStyle }}>
            {isContentCollapsed ? '▼' : '▲'}
          </span>
        </button>
      )}
      <div
        style={{
          display: isContentCollapsed ? 'none' : 'flex',
          flexDirection: 'column',
          flex: 1,
          ...contentWrapperStyle,
        }}
      >
        {children}
      </div>
      {collapsible && isContentCollapsed && (
        <div style={collapsedNoticeStyle}>{derivedCollapsedNotice}</div>
      )}
    </Component>
  );
};
