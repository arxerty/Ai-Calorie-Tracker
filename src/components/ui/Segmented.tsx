'use client';

import React, { useId } from 'react';
import { motion } from 'framer-motion';
import { useTma } from '@/components/tma-provider';
import { cn } from '@/lib/cn';

interface SegmentedProps<T extends string> {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}

/** iOS segmented control with a sliding thumb. */
export default function Segmented<T extends string>({ options, value, onChange, className }: SegmentedProps<T>) {
  const { hapticSelectionChange } = useTma();
  const thumbId = useId();

  return (
    <div role="tablist" className={cn('flex rounded-[9px] bg-fill p-[2px]', className)}>
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              if (!selected) {
                hapticSelectionChange();
                onChange(opt.id);
              }
            }}
            className="relative h-8 min-w-0 flex-1 rounded-[7px] px-2 text-footnote font-semibold text-label"
          >
            {selected && (
              <motion.span
                layoutId={thumbId}
                className="absolute inset-0 rounded-[7px] bg-white shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] dark:bg-[#636366]"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative z-10 block truncate">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
