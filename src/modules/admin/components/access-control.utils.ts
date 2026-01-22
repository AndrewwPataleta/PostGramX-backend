import axios from 'axios';

export const ACCESS_DENIED_MESSAGE = 'Access denied';

const containsAccessDeniedPhrase = (value?: string | null): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return (
    normalized.includes('access denied') ||
    normalized.includes('insufficient permissions') ||
    normalized.includes('forbidden') ||
    normalized.includes('status code 403')
  );
};

const extractMessage = (payload: unknown): string | null => {
  if (!payload) {
    return null;
  }
  if (typeof payload === 'string') {
    return payload;
  }
  if (typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    return typeof message === 'string' ? message : null;
  }
  return null;
};

export const isAccessDeniedError = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  if (
    typeof (error as { status?: number }).status === 'number' &&
    (error as { status?: number }).status === 403
  ) {
    return true;
  }

  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) {
      return true;
    }
    const responseMessage = extractMessage(error.response?.data);
    if (containsAccessDeniedPhrase(responseMessage)) {
      return true;
    }
  }

  if (error instanceof Error) {
    if (containsAccessDeniedPhrase(error.message)) {
      return true;
    }
  }

  const fallbackMessage = typeof error === 'string' ? error : null;
  return containsAccessDeniedPhrase(fallbackMessage);
};
