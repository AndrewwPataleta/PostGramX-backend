import React from 'react';

import {
  cardContentStyle,
  headingStyle,
  pageWrapperStyle,
  subHeadingStyle,
} from './table-styles';
import { CollapsibleCard } from './collapsible-card';

export type AccessDeniedMessageProps = {
  title?: string;
  description?: string;
};

export const AccessDeniedMessage: React.FC<AccessDeniedMessageProps> = ({
  title = 'Access denied',
  description = 'You do not have permission to view this section.',
}) => (
  <div style={pageWrapperStyle}>
    <CollapsibleCard>
      <div style={cardContentStyle}>
        <h1 style={headingStyle}>{title}</h1>
        {description && <p style={subHeadingStyle}>{description}</p>}
      </div>
    </CollapsibleCard>
  </div>
);
