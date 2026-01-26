import type { AnchorHTMLAttributes, CSSProperties, ReactNode } from 'react';

const openLinkButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'flex-start',
  marginTop: '6px',
  padding: '8px 16px',
  borderRadius: '16px',
  border: '1px solid #E98A98',
  backgroundColor: '#ffffff',
  color: '#E98A98',
  fontSize: '13px',
  fontWeight: 600,
  textDecoration: 'none',
  gap: '6px',
  boxShadow: '0 2px 8px rgba(233, 138, 152, 0.12)',
};

type OpenLinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children?: ReactNode;
};

export const OpenLinkButton = ({
  href,
  children = 'Open link',
  style,
  target,
  rel,
  ...rest
}: OpenLinkButtonProps) => (
  <a
    href={href}
    target={target ?? '_blank'}
    rel={rel ?? 'noreferrer'}
    style={{ ...openLinkButtonStyle, ...style }}
    {...rest}
  >
    {children}
  </a>
);

export default OpenLinkButton;
