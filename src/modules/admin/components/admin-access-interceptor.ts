import type { AdminJSGlobal } from './adminjs-global';
import {
  ACCESS_DENIED_MESSAGE,
  isAccessDeniedError,
} from './access-control.utils';

const OVERLAY_ID = 'postgramx-admin-access-denied-overlay';
const OVERLAY_VISIBLE_CLASS = 'postgramx-admin-access-denied-visible';

declare global {
  interface Window {
    // @ts-ignore
    AdminJS?: AdminJSGlobal;
  }
}

const CONTENT_SELECTORS = [
  'main[data-css]',
  'main[role="main"]',
  '#app main',
  '#app section',
  'main',
];

const findContentElement = () => {
  if (typeof document === 'undefined') {
    return null;
  }

  for (const selector of CONTENT_SELECTORS) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLElement) {
      return element;
    }
  }

  return null;
};

const ensureOverlay = () => {
  if (typeof document === 'undefined') {
    return null;
  }

  let overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    return overlay;
  }

  overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(15, 23, 42, 0.6)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '24px';
  overlay.style.zIndex = '9999';
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.transition = 'opacity 0.2s ease';

  const card = document.createElement('div');
  card.style.background = '#ffffff';
  card.style.borderRadius = '16px';
  card.style.padding = '24px 32px';
  card.style.maxWidth = '420px';
  card.style.textAlign = 'center';
  card.style.boxShadow = '0 20px 60px rgba(15, 23, 42, 0.2)';

  const title = document.createElement('div');
  title.textContent = ACCESS_DENIED_MESSAGE;
  title.style.fontSize = '18px';
  title.style.fontWeight = '600';
  title.style.marginBottom = '8px';

  const description = document.createElement('div');
  description.textContent =
    'Your current admin account does not have permissions to view this page.';
  description.style.color = '#64748B';
  description.style.fontSize = '14px';

  card.appendChild(title);
  card.appendChild(description);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  return overlay;
};

const toggleOverlay = (visible: boolean) => {
  const overlay = ensureOverlay();
  if (!overlay) {
    return;
  }

  overlay.classList.toggle(OVERLAY_VISIBLE_CLASS, visible);
  overlay.style.opacity = visible ? '1' : '0';
  overlay.style.pointerEvents = visible ? 'auto' : 'none';

  const content = findContentElement();
  if (content) {
    content.style.filter = visible ? 'blur(4px)' : 'none';
  }
};

const interceptAdminErrors = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const adminJs = window.AdminJS;
  if (!adminJs?.ApiClient) {
    return;
  }

  const originalClient = adminJs.ApiClient;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const WrappedClient = function (this: any, ...args: any[]) {
    const client = new (originalClient as any)(...args);

    const wrapMethod = (methodName: string) => {
      const originalMethod = client[methodName];
      if (typeof originalMethod !== 'function') {
        return;
      }

      client[methodName] = async (...methodArgs: any[]) => {
        try {
          const result = await originalMethod(...methodArgs);
          toggleOverlay(false);
          return result;
        } catch (error) {
          if (isAccessDeniedError(error)) {
            toggleOverlay(true);
          }
          throw error;
        }
      };
    };

    Object.keys(client).forEach((key) => wrapMethod(key));

    return client;
  } as any;

  adminJs.ApiClient = WrappedClient;
};

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', interceptAdminErrors);
  } else {
    interceptAdminErrors();
  }
}
