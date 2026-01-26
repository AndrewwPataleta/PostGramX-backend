const designSystemCss = `
:root {
  --gx-input-font-family: 'Inter', 'Roboto', 'Helvetica', sans-serif;
  --gx-input-font-size: 15px;
  --gx-input-line-height: 1.45;
  --gx-input-height: 46px;
  --gx-input-padding-y: 12px;
  --gx-input-padding-x: 16px;
  --gx-input-border-radius: 14px;
  --gx-input-border-color: rgba(255, 255, 255, 0.22);
  --gx-input-border-color-focus: rgba(34, 211, 238, 0.55);
  --gx-input-background: rgba(12, 11, 19, 0.65);
  --gx-input-background-focus: rgba(18, 17, 30, 0.85);
  --gx-input-color: #f7f8ff;
  --gx-input-placeholder-color: #94a3b8;
  --gx-input-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  --gx-input-shadow-focus: 0 12px 32px rgba(34, 211, 238, 0.25);
  --gx-checkbox-size: 27px;
  --gx-checkbox-radius: 8px;
  --gx-checkbox-border: #e98a98;
  --gx-checkbox-background: #ffffff;
  --gx-checkbox-accent: #e98a98;
  --gx-checkbox-shadow: 0 4px 12px rgba(233, 138, 152, 0.15);
  --gx-file-button-bg: #ffffff;
  --gx-file-button-border: #e5e7eb;
  --gx-file-button-color: #374151;
}

input:not([type='checkbox']):not([type='radio']):not([type='range']),
select,
textarea {
  font-family: var(--gx-input-font-family);
  font-size: var(--gx-input-font-size);
  line-height: var(--gx-input-line-height);
  min-height: var(--gx-input-height);
  padding: var(--gx-input-padding-y) var(--gx-input-padding-x);
  border-radius: var(--gx-input-border-radius);
  border: 1px solid var(--gx-input-border-color);
  background-color: var(--gx-input-background);
  color: var(--gx-input-color);
  box-shadow: var(--gx-input-shadow);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

textarea {
  min-height: calc(var(--gx-input-height) * 1.7);
  padding-top: calc(var(--gx-input-padding-y) + 4px);
  padding-bottom: calc(var(--gx-input-padding-y) + 4px);
}

input::placeholder,
select::placeholder,
textarea::placeholder {
  color: var(--gx-input-placeholder-color);
}

input[type='checkbox'] {
  width: var(--gx-checkbox-size);
  height: var(--gx-checkbox-size);
  border-radius: var(--gx-checkbox-radius);
  border: 2px solid var(--gx-checkbox-border);
  background-color: var(--gx-checkbox-background);
  box-shadow: var(--gx-checkbox-shadow);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease,
    transform 0.2s ease;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 65%;
}

input[type='checkbox']:hover {
  box-shadow: 0 6px 16px rgba(233, 138, 152, 0.25);
  transform: translateY(-1px);
}

input[type='checkbox']:checked {
  background-color: var(--gx-checkbox-accent);
  border-color: var(--gx-checkbox-accent);
  box-shadow: inset 0 4px 12px rgba(0, 0, 0, 0.1);
  background-image: url("data:image/svg+xml,%3Csvg%20viewBox%3D'0%200%2024%2024'%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20fill%3D'none'%3E%3Cpath%20d%3D'M5%2012.5L10.2%2017.5L19%207.5'%20stroke%3D'%23e98a98'%20stroke-width%3D'3'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%2F%3E%3C%2Fsvg%3E");
}

input[type='checkbox']:focus-visible {
  outline: 2px solid rgba(233, 138, 152, 0.35);
  outline-offset: 2px;
}

input[type='file'] {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  min-height: auto;
  border-radius: var(--gx-input-border-radius);
  border: 1px solid var(--gx-file-button-border);
  background-color: #ffffff;
  color: #1f2937;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

input[type='file']::file-selector-button,
input[type='file']::-webkit-file-upload-button {
  margin-right: 12px;
  border-radius: 10px;
  border: 1px solid var(--gx-file-button-border);
  background-color: var(--gx-file-button-bg);
  color: var(--gx-file-button-color);
  padding: 10px 18px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

input[type='file']:hover::file-selector-button,
input[type='file']:hover::-webkit-file-upload-button {
  background-color: #f9fafb;
  color: #111827;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
}

input:focus:not([type='checkbox']):not([type='radio']):not([type='range']),
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--gx-input-border-color-focus);
  box-shadow: var(--gx-input-shadow-focus), inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  background-color: var(--gx-input-background-focus);
}

input[type='file']:focus {
  background-color: #ffffff;
  border-color: var(--gx-file-button-border);
  box-shadow: 0 0 0 2px rgba(233, 138, 152, 0.2);
}

input[disabled],
select[disabled],
textarea[disabled] {
  cursor: not-allowed;
  opacity: 0.6;
}
`;

export const PostgramX_ADMIN_DESIGN_SYSTEM_STYLES_DATA_URI = `data:text/css;base64,${Buffer.from(
  designSystemCss,
).toString('base64')}`;
