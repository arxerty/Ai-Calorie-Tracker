'use client';

import React from 'react';
import { useTma } from '@/components/tma-provider';
import { cn } from '@/lib/cn';

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Загрузка"
      className={cn('inline-block h-5 w-5 rounded-full border-2 border-current border-t-transparent', className)}
      style={{ animation: 'spin 0.7s linear infinite' }}
    />
  );
}

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: 'primary' | 'tinted' | 'gray' | 'destructive';
  size?: 'lg' | 'md' | 'sm';
  loading?: boolean;
  className?: string;
}

const VARIANTS = {
  primary: 'bg-accent text-white',
  tinted: 'bg-accent/15 text-accent',
  gray: 'bg-fill text-accent',
  destructive: 'bg-danger/15 text-danger',
};

const SIZES = {
  lg: 'h-[50px] w-full rounded-[14px] text-body font-semibold',
  md: 'h-11 rounded-xl px-5 text-callout font-semibold',
  sm: 'h-8 rounded-full px-3.5 text-footnote font-semibold',
};

export default function Button({
  variant = 'primary',
  size = 'lg',
  loading,
  disabled,
  className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const { hapticImpact } = useTma();

  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      onClick={(e) => {
        hapticImpact('light');
        onClick?.(e);
      }}
      className={cn(
        'pressable-scale inline-flex items-center justify-center gap-2 disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
    >
      {loading ? <Spinner className="h-[18px] w-[18px]" /> : children}
    </button>
  );
}
