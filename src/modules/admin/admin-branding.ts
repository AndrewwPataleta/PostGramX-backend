import { readFileSync } from 'fs';
import { join } from 'path';

const svgContent = `
<svg width="240" height="60" viewBox="0 0 240 60" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="PostgramXGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8B5CF6" />
      <stop offset="50%" stop-color="#22D3EE" />
      <stop offset="100%" stop-color="#F472B6" />
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="238" height="58" rx="14" fill="rgba(8, 7, 15, 0.65)" stroke="rgba(255,255,255,0.3)" />
  <rect x="6" y="6" width="228" height="48" rx="12" fill="rgba(14,13,22,0.85)" stroke="rgba(255,255,255,0.15)" />
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="'Inter', 'Roboto', 'Helvetica', sans-serif" font-size="28" font-weight="600" fill="url(#PostgramXGradient)">
    PostgramX Admin
  </text>
</svg>`;

const loginCss = `
:root {
  --PostgramX-login-bg-1: #0b0a12;
  --PostgramX-login-bg-2: #15102a;
  --PostgramX-login-accent-a: rgba(139, 92, 246, 0.65);
  --PostgramX-login-accent-b: rgba(34, 211, 238, 0.55);
  --PostgramX-login-accent-c: rgba(244, 114, 182, 0.45);
  --PostgramX-login-surface: #ffffff;
  --PostgramX-login-surface-muted: #f9fafb;
  --PostgramX-login-border: #e5e7eb;
  --PostgramX-login-text: #111827;
  --PostgramX-login-muted: #6b7280;
  --PostgramX-login-input-bg: #ffffff;
  --PostgramX-login-input-border: #d1d5db;
  --PostgramX-login-input-text: #1f2937;
  --PostgramX-login-input-placeholder: #94a3b8;
  --PostgramX-login-button-bg: #e98a98;
  --PostgramX-login-button-bg-hover: #d66a79;
  --PostgramX-login-button-shadow: rgba(233, 138, 152, 0.35);
}

body {
  min-height: 100vh;
  background: radial-gradient(circle at 20% 20%, var(--PostgramX-login-accent-a), transparent 55%),
    radial-gradient(circle at 80% 10%, var(--PostgramX-login-accent-b), transparent 60%),
    radial-gradient(circle at 50% 80%, var(--PostgramX-login-accent-c), transparent 65%),
    linear-gradient(135deg, var(--PostgramX-login-bg-1), var(--PostgramX-login-bg-2));
  background-attachment: fixed;
  font-family: 'Inter', 'Roboto', sans-serif;
}

.login__Wrapper {
  padding: 48px 16px 64px;
  color: var(--PostgramX-login-text);
}

.login__Wrapper > div:first-child {
  border-radius: 32px;
  background: rgba(255, 255, 255, 0.12) !important;
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 18px 60px rgba(8, 6, 20, 0.35);
}

.login__Wrapper > div:first-child > div:first-child {
  border-radius: 32px 0 0 32px;
  background: linear-gradient(150deg, rgba(139, 92, 246, 0.85), rgba(34, 211, 238, 0.85)) !important;
}

.login__Wrapper form {
  background: var(--PostgramX-login-surface-muted) !important;
  border-radius: 0 32px 32px 0;
  color: var(--PostgramX-login-text);
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 32px;
  border-left: 1px solid var(--PostgramX-login-border);
}

.login__Wrapper form h5 {
  font-size: 28px;
  text-align: center;
  color: var(--PostgramX-login-text);
  margin-bottom: 12px;
}

.login__Wrapper label {
  color: var(--PostgramX-login-muted);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.login__Wrapper .adminjs_FormGroup {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.login__Wrapper input[type='text'],
.login__Wrapper input[type='password'],
.login__Wrapper input:not([type]) {
  background: var(--PostgramX-login-input-bg) !important;
  border: 1px solid var(--PostgramX-login-input-border) !important;
  border-radius: 12px;
  color: var(--PostgramX-login-input-text) !important;
  padding: 12px 16px;
  font-size: 15px;
  line-height: 1.45;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.login__Wrapper input::placeholder {
  color: var(--PostgramX-login-input-placeholder);
  letter-spacing: 0.01em;
}

.login__Wrapper input:focus {
  outline: none;
  border-color: var(--PostgramX-login-button-bg) !important;
  box-shadow: 0 0 0 3px rgba(233, 138, 152, 0.25);
  background: #fff;
}

.login__Wrapper button,
.login__Wrapper .adminjs_Button {
  border: none;
  border-radius: 16px !important;
  background: var(--PostgramX-login-button-bg) !important;
  color: #ffffff !important;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 14px 0;
  box-shadow: 0 16px 40px var(--PostgramX-login-button-shadow);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.login__Wrapper button:hover,
.login__Wrapper .adminjs_Button:hover {
  transform: translateY(-1px);
  background: var(--PostgramX-login-button-bg-hover) !important;
  box-shadow: 0 22px 50px rgba(214, 106, 121, 0.4);
}

.login__Wrapper button:focus,
.login__Wrapper .adminjs_Button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(233, 138, 152, 0.35);
}

.login__Wrapper .made-with-love {
  color: rgba(247, 248, 255, 0.65);
}
`;

const svgDataUri = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
const cssDataUri = `data:text/css;base64,${Buffer.from(loginCss).toString('base64')}`;

const logoPath = join(process.cwd(), 'public', 'PostgramX_logo.webp');

let logoDataUri = svgDataUri;

try {
  const logoBuffer = readFileSync(logoPath);
  logoDataUri = `data:image/webp;base64,${logoBuffer.toString('base64')}`;
} catch {
}

export const PostgramX_ADMIN_LOGO_DATA_URI = logoDataUri;
export const PostgramX_ADMIN_LOGIN_STYLES_DATA_URI = cssDataUri;
