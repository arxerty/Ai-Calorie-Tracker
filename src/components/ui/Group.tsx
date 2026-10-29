'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

interface GroupProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** iOS "inset grouped" list section: small caps header, rounded card of rows, footnote. */
export function Group({ header, footer, className, children }: GroupProps) {
  return (
    <section className={cn('mb-6', className)}>
      {header && (
        <h3 className="mb-1.5 px-4 text-footnote uppercase tracking-wide text-label2">{header}</h3>
      )}
      <div className="divide-y-[0.5px] divide-separator overflow-hidden rounded-2xl bg-card">{children}</div>
      {footer && <p className="mt-1.5 px-4 text-footnote text-label2">{footer}</p>}
    </section>
  );
}

interface FieldRowProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  placeholder?: string;
  type?: 'number' | 'text';
  disabled?: boolean;
  /** Text inputs take the whole row; numbers sit on the right */
  wide?: boolean;
}

/** A list row with a label on the left and an inline text field on the right (iOS Settings style). */
export function FieldRow({ label, value, onChange, unit, placeholder, type = 'number', disabled, wide }: FieldRowProps) {
  return (
    <label className="flex min-h-[44px] items-center gap-3 px-4 py-1.5">
      <span className={cn('text-body', disabled && 'text-label2')}>{label}</span>
      <input
        type={type}
        inputMode={type === 'number' ? 'decimal' : 'text'}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'min-w-0 bg-transparent text-right tabular outline-none disabled:text-label2',
          wide ? 'flex-1' : 'ml-auto w-24'
        )}
      />
      {unit && <span className="-ml-1 shrink-0 text-body text-label2">{unit}</span>}
    </label>
  );
}

interface RowProps {
  /** Leading icon element (rendered inside a colored rounded square when iconBg is set) */
  icon?: React.ReactNode;
  iconBg?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned secondary text */
  value?: React.ReactNode;
  /** Custom trailing element (switch, button, input…) */
  trailing?: React.ReactNode;
  chevron?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function Row({
  icon,
  iconBg,
  title,
  subtitle,
  value,
  trailing,
  chevron,
  destructive,
  disabled,
  onClick,
  className,
  children,
}: RowProps) {
  const content = (
    <>
      {icon && (
        <span
          className={cn(
            'flex shrink-0 items-center justify-center text-white',
            iconBg ? 'h-[30px] w-[30px] rounded-[7px]' : 'h-[30px] w-[30px]'
          )}
          style={iconBg ? { background: iconBg } : undefined}
        >
          {icon}
        </span>
      )}
      {children ?? (
        <span className="min-w-0 flex-1 text-left">
          {title && (
            <span className={cn('block truncate text-body', destructive && 'text-danger')}>{title}</span>
          )}
          {subtitle && <span className="block text-footnote text-label2">{subtitle}</span>}
        </span>
      )}
      {value !== undefined && <span className="shrink-0 text-body text-label2 tabular">{value}</span>}
      {trailing}
      {chevron && <ChevronRight size={18} className="shrink-0 text-label3" strokeWidth={2.4} />}
    </>
  );

  const base = cn('flex min-h-[44px] w-full items-center gap-3 px-4 py-2', className);

  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={cn(base, 'pressable disabled:opacity-40')}>
        {content}
      </button>
    );
  }
  return <div className={base}>{content}</div>;
}
