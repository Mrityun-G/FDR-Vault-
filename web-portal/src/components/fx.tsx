/**
 * AICTE Intelligent Regulatory Validation Platform (AI-IRVP)
 * Small animated building blocks shared across the staff portal.
 * Every effect falls back to a static rendering when the user prefers reduced motion.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react';

/** Number that counts up to `value` whenever it changes. */
export const CountUp: React.FC<{ value: number; format?: (n: number) => string; duration?: number; className?: string }> = ({
  value,
  format = n => Math.round(n).toLocaleString('en-IN'),
  duration = 1.1,
  className
}) => {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: v => setShown(v)
    });
    from.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);
  return <span className={className}>{format(shown)}</span>;
};

/** Cycles through short phrases with a vertical slide. */
export const RotatingText: React.FC<{ items: React.ReactNode[]; interval?: number; className?: string }> = ({ items, interval = 3200, className }) => {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2 || reduce) return;
    const t = window.setInterval(() => setI(k => (k + 1) % items.length), interval);
    return () => window.clearInterval(t);
  }, [items.length, interval, reduce]);
  if (items.length === 0) return null;
  return (
    <span className={`relative inline-flex overflow-hidden align-bottom ${className || ''}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={i % items.length}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block"
        >
          {items[i % items.length]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

export interface TickerItem {
  id: string;
  text: string;
  tone?: 'info' | 'success' | 'warning' | 'critical';
  onClick?: () => void;
}

const TONE: Record<string, string> = {
  info: 'bg-sky-400',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  critical: 'bg-rose-400'
};

/** Continuously scrolling strip of live updates (pauses on hover, static with reduced motion). */
export const Ticker: React.FC<{ items: TickerItem[]; label?: string; className?: string }> = ({ items, label = 'LIVE', className }) => {
  if (items.length === 0) return null;
  const row = (copy: number) =>
    items.map(item => (
      <button
        key={`${copy}-${item.id}`}
        type="button"
        onClick={item.onClick}
        tabIndex={copy === 0 ? 0 : -1}
        aria-hidden={copy === 1}
        className="inline-flex items-center gap-2 px-5 text-xs font-medium text-white/90 hover:text-white whitespace-nowrap cursor-pointer"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${TONE[item.tone || 'info']}`} />
        {item.text}
      </button>
    ));
  return (
    <div className={`flex items-center overflow-hidden rounded-xl bg-slate-950/90 ring-1 ring-white/10 ${className || ''}`}>
      <span className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-[10px] font-extrabold tracking-widest text-white bg-rose-600">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        {label}
      </span>
      <div className="relative flex-1 overflow-hidden mask-fade-x group">
        <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused] py-2 motion-reduce:animate-none">
          {row(0)}
          {row(1)}
        </div>
      </div>
    </div>
  );
};

/** Pulsing green dot with a label, for "live" status. */
export const LiveDot: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-50">
    <span className="relative w-2 h-2 rounded-full bg-emerald-400 animate-pulse-ring" />
    {label}
  </span>
);

/** Stagger container + item variants for lists and grids. */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } }
};
export const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } }
};

/** "x seconds ago" that refreshes itself. */
export function useTimeAgo(date: Date | null): string {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => tick(k => k + 1), 10000);
    return () => window.clearInterval(t);
  }, []);
  if (!date) return 'never';
  const s = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
