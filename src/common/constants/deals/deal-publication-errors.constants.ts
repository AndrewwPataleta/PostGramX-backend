export const DEAL_PUBLICATION_ERRORS = {
  POST_EDITED: 'POST_EDITED',
} as const;

export type DealPublicationErrorCode =
  (typeof DEAL_PUBLICATION_ERRORS)[keyof typeof DEAL_PUBLICATION_ERRORS];
