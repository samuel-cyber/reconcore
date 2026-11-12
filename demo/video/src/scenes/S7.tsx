import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { CheckSeal, SparkIcon, Stage, useSpringIn } from './common';

const Lane: React.FC<{
  side: 'left' | 'right'; title: string; kicker: string; bullets: string[];
  color: string; soft: string; delay: number; icon: React.ReactNode;
}> = ({ title, kicker, bullets, color, soft, delay, icon }) => {
  const s = useSpringIn(delay);
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width: 740, padding: '46px 48px', borderRadius: 26,
        background: soft, border: `2px solid ${color}`,
        opacity: s, transform: `translateY(${(1 - s) * 30}px)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {icon}
        <div>
          <div style={{ fontSize: 24, letterSpacing: 3, color, fontWeight: 700 }}>{kicker}</div>
          <div style={{ fontSize: 46, fontWeight: 700, color: theme.text, marginTop: 4 }}>{title}</div>
        </div>
      </div>
      <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {bullets.map((b, i) => {
          const o = interpolate(frame, [delay + 12 + i * 8, delay + 26 + i * 8], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          return (
            <div key={b} style={{ fontSize: 32, color: theme.text, opacity: o, display: 'flex', gap: 14 }}>
              <span style={{ color }}>—</span>
              <span style={{ opacity: 0.92 }}>{b}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** The core design choice: AI coaches, code decides. */
export const S7: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const seal = useSpringIn(fps * 7.4, 13);
  const stamp = interpolate(frame, [fps * 7.4, fps * 8.2], [1.5, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 44 }}>
        <div style={{ display: 'flex', gap: 56, alignItems: 'stretch', marginTop: -40 }}>
          <Lane
            side="left" kicker="AI" title="Writes and coaches" delay={6}
            color={theme.amber} soft={theme.amberSoft}
            icon={<SparkIcon size={74} color={theme.amber} />}
            bullets={['Writes the scenario', 'Coaches with Socratic hints', 'Never sees the grade']}
          />
          <div style={{ position: 'relative', width: 0 }}>
            <div style={{
              position: 'absolute', left: -1, top: 10, bottom: 10, width: 2,
              background: 'linear-gradient(180deg, transparent, rgba(148,163,184,0.5), transparent)',
            }} />
          </div>
          <div style={{ position: 'relative' }}>
            <Lane
              side="right" kicker="CODE" title="Grades and signs" delay={16}
              color={theme.green} soft={theme.greenSoft}
              icon={<CheckSeal size={74} color={theme.green} />}
              bullets={['Exact-match grading', 'Same answer, same result', 'Ed25519 signature']}
            />
            <div
              style={{
                position: 'absolute', right: -42, bottom: -42,
                opacity: seal, transform: `scale(${stamp}) rotate(${(1 - seal) * -18}deg)`,
                background: theme.bg, borderRadius: '50%', padding: 10,
                boxShadow: `0 0 0 3px ${theme.green}, 0 18px 40px rgba(0,0,0,0.5)`,
              }}
            >
              <CheckSeal size={88} color={theme.green} />
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
