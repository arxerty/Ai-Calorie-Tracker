'use client';

import React from 'react';
import { cn } from '@/lib/cn';

interface BarDatum {
  key: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  /** Dashed reference line (daily goal) */
  target?: number;
  height?: number;
  color: string;
  /** Bars above the target use this color instead */
  overColor?: string;
  selectedIndex: number | null;
  onSelect: (index: number | null) => void;
  /** Labels under the first / middle / last bar */
  labels: [string, string, string];
}

/** Day-by-day bar chart. Bars are plain divs so corners and text stay crisp at any width. */
export function BarChart({ data, target, height = 160, color, overColor, selectedIndex, onSelect, labels }: BarChartProps) {
  const max = Math.max(1, target ?? 0, ...data.map((d) => d.value)) * 1.08;
  const gap = data.length > 40 ? 1 : data.length > 14 ? 2 : 6;

  return (
    <div>
      <div className="relative" style={{ height }}>
        {target !== undefined && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-label3"
            style={{ bottom: `${(target / max) * 100}%` }}
          />
        )}
        <div className="flex h-full items-end" style={{ gap }}>
          {data.map((d, i) => {
            const over = target !== undefined && overColor && d.value > target * 1.1;
            const dimmed = selectedIndex !== null && selectedIndex !== i;
            return (
              <button
                key={d.key}
                type="button"
                aria-label={`${d.key}: ${d.value}`}
                onClick={() => onSelect(selectedIndex === i ? null : i)}
                className="group flex h-full min-w-0 flex-1 items-end"
              >
                <span
                  className={cn('block w-full transition-opacity', data.length > 40 ? 'rounded-t-[1.5px]' : 'rounded-t-[4px]')}
                  style={{
                    height: `${(d.value / max) * 100}%`,
                    // Days without data keep a faint stub so the chart still reads as N days
                    minHeight: 3,
                    background: d.value === 0 ? 'var(--fill-strong)' : over ? overColor : color,
                    opacity: dimmed ? 0.35 : 1,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-caption text-label2">
        <span>{labels[0]}</span>
        <span>{labels[1]}</span>
        <span>{labels[2]}</span>
      </div>
    </div>
  );
}

interface LinePoint {
  /** Position on the time axis (ms) */
  t: number;
  y: number;
}

interface LineChartProps {
  points: LinePoint[];
  height?: number;
  color: string;
  labels: [string, string];
}

/** Smooth-edged line with a soft area fill; points are placed by real time, not by index. */
export function LineChart({ points, height = 150, color, labels }: LineChartProps) {
  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const yVals = points.map((p) => p.y);
  const pad = Math.max(0.5, (Math.max(...yVals) - Math.min(...yVals)) * 0.2);
  const yMin = Math.min(...yVals) - pad;
  const yMax = Math.max(...yVals) + pad;

  // Keep a little horizontal margin so the end dots are not clipped
  const X_PAD = 3;
  const px = (t: number) => (tMax === tMin ? 50 : X_PAD + ((t - tMin) / (tMax - tMin)) * (100 - 2 * X_PAD));
  const py = (y: number) => 100 - ((y - yMin) / (yMax - yMin)) * 100;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(p.t)} ${py(p.y)}`).join(' ');
  const area = `${line} L ${px(tMax)} 100 L ${px(tMin)} 100 Z`;
  const gradId = `line-grad-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <div>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 50, 100].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="var(--separator)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill={`url(#${gradId})`} />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {points.map((p, i) => {
          const isLast = i === points.length - 1;
          return (
            <span
              key={p.t}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card"
              style={{
                left: `${px(p.t)}%`,
                top: `${py(p.y)}%`,
                width: isLast ? 12 : 8,
                height: isLast ? 12 : 8,
                background: color,
              }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-caption text-label2">
        <span>{labels[0]}</span>
        <span>{labels[1]}</span>
      </div>
    </div>
  );
}

/** Thin horizontal progress bar. */
export function Bar({ value, max, color, className }: { value: number; max: number; color: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-fill', className)}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
