import React, {
  forwardRef,
  useCallback,
  useRef,
  type CSSProperties,
  type ForwardedRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

import { buttonStyle } from './table-styles';

const containerStyle: CSSProperties = {
  background: '#ffffff',
  border: '1px solid #f3f4f6',
  borderRadius: '16px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  flexWrap: 'wrap',
};

const labelStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#4b5563',
};

const helperStyle: CSSProperties = {
  fontSize: '12px',
  color: '#6b7280',
  marginTop: '4px',
};

const placeholderStyle: CSSProperties = {
  fontSize: '13px',
  color: '#9ca3af',
};

const fileLabelStyle: CSSProperties = {
  fontSize: '14px',
  color: '#1f2937',
};

const chooseButtonStyle: CSSProperties = {
  ...buttonStyle,
  whiteSpace: 'nowrap',
  padding: '10px 18px',
};

type ChooseFileProps = {
  label: ReactNode;
  helperText?: ReactNode;
  buttonText?: string;
  fileLabel?: ReactNode;
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'style'>;

const assignRef = (
  ref: ForwardedRef<HTMLInputElement>,
  node: HTMLInputElement | null,
) => {
  if (typeof ref === 'function') {
    ref(node);
  } else if (ref) {
    ref.current = node;
  }
};

export const ChooseFile = forwardRef<HTMLInputElement, ChooseFileProps>(
  (
    {
      label,
      helperText,
      buttonText = 'Choose file',
      fileLabel,
      disabled,
      containerProps,
      ...inputProps
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        assignRef(ref, node);
      },
      [ref],
    );

    const handleButtonClick = useCallback(() => {
      if (!disabled) {
        inputRef.current?.click();
      }
    }, [disabled]);

    return (
      <div {...containerProps} style={{ ...containerStyle, ...containerProps?.style }}>
        <div style={headerStyle}>
          <div>
            <div style={labelStyle}>{label}</div>
            {helperText ? <div style={helperStyle}>{helperText}</div> : null}
          </div>
          <button
            type="button"
            style={{
              ...chooseButtonStyle,
              opacity: disabled ? 0.6 : 1,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
            onClick={handleButtonClick}
            disabled={disabled}
          >
            {buttonText}
          </button>
        </div>
        <div style={fileLabel ? fileLabelStyle : placeholderStyle}>
          {fileLabel ?? 'No file selected'}
        </div>
        <input
          {...inputProps}
          ref={setRefs}
          type="file"
          style={{ display: 'none' }}
          disabled={disabled}
        />
      </div>
    );
  },
);

ChooseFile.displayName = 'ChooseFile';
