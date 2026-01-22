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
  collapsible?: boolean;
};

type CollapsibleCardProps<T extends ElementType> = CollapsibleCardBaseProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof CollapsibleCardBaseProps<T>>;

export const CollapsibleCard = <T extends ElementType = 'section'>(
  props: CollapsibleCardProps<T>,
) => {
  const {
    as,
    children,
    style,
    defaultCollapsed = false,
    collapsedNotice = 'Content hidden',
    collapsible = true,
    ...rest
  } = props;
  const Component = (as || 'section') as ElementType;
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const mergedStyle = useMemo(
    () => ({
      ...cardStyle,
      position: 'relative',
      overflow: 'hidden',
      ...style,
    }),
    [style],
  );

  const toggle = useCallback(() => {
    if (!collapsible) {
      return;
    }
    setCollapsed((prev) => !prev);
  }, [collapsible]);

  return (
    <Component style={mergedStyle} {...rest}>
      {collapsible ? (
        <button type="button" onClick={toggle} style={toggleButtonStyle}>
          <span
            style={{
              ...arrowIconStyle,
              transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            ⌃
          </span>
        </button>
      ) : null}
      {collapsed ? (
        <div style={collapsedNoticeStyle}>{collapsedNotice}</div>
      ) : (
        children
      )}
    </Component>
  );
};
