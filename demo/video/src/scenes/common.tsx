import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

/** Deep-navy stage with a faint ledger grid. */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: theme.bg, fontFamily: theme.sans, color: theme.text }}>
    <AbsoluteFill
      style={{
        backgroundImage:
          'linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)',
        backgroundSize: '80px 80px',
        maskImage: 'radial-gradient(circle at 50% 45%, black 10%, transparent 78%)',
      }}
    />
    <AbsoluteFill
      style={{
        background: 'radial-gradient(900px 540px at 50% 38%, rgba(16,185,129,0.10), transparent 70%)',
      }}
    />
    {children}
  </AbsoluteFill>
);

export const useSpringIn = (delay = 0, damping = 16) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping, mass: 0.9 } });
};

/** Fade + rise, the only entrance this video uses. */
export const Rise: React.FC<{
  delay?: number;
  children: React.ReactNode;
  distance?: number;
  style?: React.CSSProperties;
}> = ({ delay = 0, children, distance = 26, style }) => {
  const s = useSpringIn(delay);
  return (
    <div style={{ opacity: s, transform: `translateY(${(1 - s) * distance}px)`, ...style }}>
      {children}
    </div>
  );
};

export const FadeOut: React.FC<{ at: number; over?: number; children: React.ReactNode }> = ({
  at, over = 14, children,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [at, at + over], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return <div style={{ opacity }}>{children}</div>;
};

export const Label: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = theme.muted }) => (
  <div style={{ fontSize: 24, letterSpacing: 3, textTransform: 'uppercase', color, fontWeight: 600 }}>
    {children}
  </div>
);

/* ---------- hand-drawn icons, no external assets ---------- */

export const TillIcon: React.FC<{ size?: number; color?: string }> = ({ size = 92, color = theme.text }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={2.4}
    strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="26" width="48" height="26" rx="4" />
    <path d="M16 26v-8a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v8" />
    <path d="M16 36h12M16 43h8" />
    <rect x="38" y="33" width="12" height="12" rx="2" />
  </svg>
);

export const WarehouseIcon: React.FC<{ size?: number; color?: string }> = ({ size = 92, color = theme.text }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={2.4}
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 28 32 12l26 16v24H6z" />
    <path d="M22 52V36h20v16" />
    <path d="M22 44h20" />
  </svg>
);

export const BankIcon: React.FC<{ size?: number; color?: string }> = ({ size = 92, color = theme.text }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={2.4}
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 26 32 12l24 14" />
    <path d="M12 26v22M24 26v22M40 26v22M52 26v22" />
    <path d="M6 52h52" />
  </svg>
);

export const CapIcon: React.FC<{ size?: number; color?: string }> = ({ size = 120, color = theme.text }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={2.4}
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 24 32 12l28 12-28 12z" />
    <path d="M16 30v12c0 3 7 6 16 6s16-3 16-6V30" />
    <path d="M56 24v14" />
  </svg>
);

export const CertIcon: React.FC<{ size?: number; color?: string }> = ({ size = 120, color = theme.text }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={2.4}
    strokeLinecap="round" strokeLinejoin="round">
    <rect x="10" y="8" width="44" height="38" rx="4" />
    <path d="M18 20h28M18 28h22M18 36h14" />
    <circle cx="44" cy="44" r="8" />
    <path d="M40 50v8l4-3 4 3v-8" />
  </svg>
);

export const JobCardIcon: React.FC<{ size?: number; color?: string }> = ({ size = 120, color = theme.text }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={2.4}
    strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="14" width="48" height="38" rx="5" />
    <path d="M22 14v-4a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v4" />
    <path d="M18 28h12M18 36h20" />
  </svg>
);

export const CheckSeal: React.FC<{ size?: number; color?: string }> = ({ size = 92, color = theme.green }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={3}
    strokeLinecap="round" strokeLinejoin="round">
    <circle cx="32" cy="32" r="22" />
    <path d="M22 33l7 7 14-15" />
  </svg>
);

export const SparkIcon: React.FC<{ size?: number; color?: string }> = ({ size = 92, color = theme.amber }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke={color} strokeWidth={2.6}
    strokeLinecap="round" strokeLinejoin="round">
    <path d="M32 8v12M32 44v12M8 32h12M44 32h12M16 16l8 8M40 40l8 8M48 16l-8 8M24 40l-8 8" />
    <circle cx="32" cy="32" r="7" />
  </svg>
);
