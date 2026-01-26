import React from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { CollapsibleCard } from './collapsible-card';

const productCardWrapperStyle: CSSProperties = {
  background: '#ffffff',
  borderRadius: '18px',
  padding: '24px',
  boxShadow: '0 20px 40px rgba(15, 23, 42, 0.12)',
};

const productCardHeaderStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const productCardHeaderRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  flexWrap: 'wrap',
  rowGap: '6px',
};

const productCardTitleStyle: CSSProperties = {
  fontSize: '24px',
  lineHeight: 1.3,
  margin: 0,
  wordBreak: 'break-word',
  flex: '1 1 320px',
  minWidth: 0,
};

const productCardMetaStyle: CSSProperties = {
  fontSize: '13px',
  color: '#94a3b8',
  whiteSpace: 'nowrap',
  alignSelf: 'flex-start',
};

const productCardChipListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
};

export const productCardChipStyle: CSSProperties = {
  borderRadius: '999px',
  padding: '4px 10px',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const productCardDetailsColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  minHeight: 0,
};

const productCardScrollableBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  paddingRight: '4px',
};

const productCardBodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const productCardFooterStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '12px',
  marginTop: 'auto',
  paddingTop: '16px',
};

type ProductCardProps = {
  title: ReactNode;
  titleMeta?: ReactNode;
  badges?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  media?: ReactNode;
  defaultCollapsed?: boolean;
  collapsedNotice?: ReactNode;
  isBodyScrollable?: boolean;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
  mediaColumnStyle?: CSSProperties;
};

export const ProductCard = ({
  title,
  titleMeta,
  badges,
  children,
  footer,
  media,
  defaultCollapsed = false,
  collapsedNotice,
  isBodyScrollable = true,
  style,
  bodyStyle,
  mediaColumnStyle,
}: ProductCardProps) => {
  const hasMedia = Boolean(media);

  const bodyContainerStyle = isBodyScrollable
    ? { ...productCardScrollableBodyStyle, ...bodyStyle }
    : { ...productCardBodyStyle, ...bodyStyle };

  return (
    <CollapsibleCard
      style={{
        ...productCardWrapperStyle,
        ...style,
      }}
      contentWrapperStyle={{
        display: 'grid',
        gridTemplateColumns: hasMedia
          ? 'minmax(0, 2fr) minmax(0, 1fr)'
          : 'minmax(0, 1fr)',
        gap: '24px',
        alignItems: 'stretch',
      }}
      defaultCollapsed={defaultCollapsed}
      collapsedNotice={collapsedNotice}
    >
      <>
        <div style={productCardDetailsColumnStyle}>
          <div style={productCardHeaderStyle}>
            <div style={productCardHeaderRowStyle}>
              <h2 style={productCardTitleStyle}>{title}</h2>
              {titleMeta && <span style={productCardMetaStyle}>{titleMeta}</span>}
            </div>
            {badges && <div style={productCardChipListStyle}>{badges}</div>}
          </div>
          <div style={bodyContainerStyle}>{children}</div>
          {footer && <div style={productCardFooterStyle}>{footer}</div>}
        </div>
        {hasMedia && <div style={mediaColumnStyle}>{media}</div>}
      </>
    </CollapsibleCard>
  );
};

ProductCard.displayName = 'ProductCard';
