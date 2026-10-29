'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ProgressRingProps {
  /** 0..1 (values above 1 are clamped: the ring is simply full) */
  progress: number;
  size: number;
  stroke: number;
  color: string;
  trackColor?: string;
  children?: React.ReactNode;
}

/** Activity-style ring: rounded caps, animated sweep from 12 o'clock. */
export default function ProgressRing({
  progress,
  size,
  stroke,
  color,
  trackColor = 'var(--fill)',
  children,
}: ProgressRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ type: 'spring', stiffness: 90, damping: 20 }}
          style={{ opacity: clamped === 0 ? 0 : 1 }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  );
}
