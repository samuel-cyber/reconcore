import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { BankIcon, Stage, TillIcon, WarehouseIcon, useSpringIn } from './common';

/** Cold open: the money counts up, then cracks; the trail between the three books breaks. */
export const S1: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const count = useSpringIn(4, 22);
  const amount = Math.round(count * 45000);

  const crack = interpolate(frame, [fps * 2.6, fps * 3.4], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const numberOpacity = interpolate(frame, [fps * 3.0, fps * 3.9], [1, 0.12], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const numberShift = interpolate(crack, [0, 1], [0, 14]);
  const iconsIn = interpolate(frame, [fps * 3.6, fps * 4.4], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const breakT = interpolate(frame, [fps * 5.0, fps * 6.0], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const books = [
    { icon: <TillIcon />, label: 'TILL' },
    { icon: <WarehouseIcon />, label: 'WAREHOUSE' },
    { icon: <BankIcon />, label: 'BANK' },
  ];

  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', marginTop: -90 }}>
          <div
            style={{
              fontSize: 210,
              fontWeight: 700,
              letterSpacing: -4,
              fontFamily: theme.mono,
              opacity: numberOpacity,
              transform: `translateY(${-numberShift}px)`,
              clipPath: crack > 0 ? 'polygon(0 0, 100% 0, 100% 48%, 0 54%)' : undefined,
              color: theme.text,
            }}
          >
            <span style={{ fontFamily: theme.sans, fontWeight: 600 }}>₦</span>
            {amount.toLocaleString('en-NG')}
          </div>
          {crack > 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                fontSize: 210,
                fontWeight: 700,
                letterSpacing: -4,
                fontFamily: theme.mono,
                opacity: numberOpacity,
                transform: `translateY(${numberShift}px) translateX(${crack * 10}px)`,
                clipPath: 'polygon(0 54%, 100% 48%, 100% 100%, 0 100%)',
                color: theme.text,
              }}
            >
              <span style={{ fontFamily: theme.sans, fontWeight: 600 }}>₦</span>
              {amount.toLocaleString('en-NG')}
            </div>
          )}
          <svg width={900} height={40} viewBox="0 0 900 40"
            style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)' }}>
            <path d="M0 24 L160 16 L310 30 L470 12 L640 28 L800 14 L900 22" fill="none"
              stroke={theme.red} strokeWidth={4} strokeLinecap="round"
              strokeDasharray={1200} strokeDashoffset={1200 - crack * 1200} opacity={0.9 - crack * 0.35} />
          </svg>
        </div>

        <div style={{ position: 'relative', marginTop: 70, opacity: iconsIn, transform: `translateY(${(1 - iconsIn) * 24}px)` }}>
          <svg width={1020} height={12} viewBox="0 0 1020 12" style={{ position: 'absolute', top: 58, left: 0 }}>
            <line x1="120" y1="6" x2={510 - breakT * 70} y2="6" stroke={theme.muted} strokeWidth={3}
              strokeDasharray="10 12" strokeLinecap="round" opacity={0.85} />
            <line x1={510 + breakT * 70} y1="6" x2="900" y2="6" stroke={theme.muted} strokeWidth={3}
              strokeDasharray="10 12" strokeLinecap="round" opacity={0.85} />
          </svg>
          <div style={{ display: 'flex', gap: 170, width: 1020, justifyContent: 'center' }}>
            {books.map((b, i) => (
              <div key={b.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: 220 }}>
                <div style={{ opacity: i === 1 && breakT > 0.4 ? 0.55 : 1 }}>{b.icon}</div>
                <div style={{ fontSize: 22, letterSpacing: 3, color: theme.muted, fontWeight: 600 }}>{b.label}</div>
              </div>
            ))}
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
