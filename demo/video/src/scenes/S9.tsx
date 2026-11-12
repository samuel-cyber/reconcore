import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { Stage, useSpringIn } from './common';

/** Outro: wordmark, thesis, and the card judges need. */
export const S9: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const mark = useSpringIn(2, 14);
  const tag = useSpringIn(14, 15);
  const card = useSpringIn(fps * 2.1, 16);
  const glow = interpolate(frame, [0, fps * 2], [0.2, 0.55], { extrapolateRight: 'clamp' });

  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            fontSize: 112, fontWeight: 700, letterSpacing: -2,
            opacity: mark, transform: `translateY(${(1 - mark) * 22}px)`,
            textShadow: `0 0 70px rgba(16,185,129,${glow})`,
          }}
        >
          ReconCore
        </div>
        <div style={{ fontSize: 42, color: theme.green, fontWeight: 600, marginTop: 10, opacity: tag }}>
          Practise the real work. Prove it with math.
        </div>

        <div
          style={{
            marginTop: 54, opacity: card, transform: `translateY(${(1 - card) * 22}px)`,
            background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 22,
            padding: '30px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          }}
        >
          <div style={{ fontSize: 26, letterSpacing: 3, color: theme.muted, fontWeight: 600 }}>
            WALE LAB NEXTGEN AI HACKATHON · TRACK 2
          </div>
          <div style={{ display: 'flex', gap: 40, fontSize: 30, color: theme.text }}>
            <span>Samuel Ojo — Backend</span>
            <span style={{ color: theme.line }}>|</span>
            <span>Ridwanullah — Frontend</span>
          </div>
          <div style={{ fontSize: 30, fontFamily: theme.mono, color: theme.green, marginTop: 4 }}>
            reconcore-app.netlify.app
          </div>
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
