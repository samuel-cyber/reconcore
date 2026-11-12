import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { Stage, useSpringIn } from './common';

const WORD = 'ReconCore';

/** Logo reveal: the wordmark assembles out of spreadsheet cells. */
export const S3: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tagline = useSpringIn(fps * 3.1);
  const dissolve = interpolate(frame, [fps * 2.3, fps * 3.3], [1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <Stage>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {WORD.split('').map((letter, i) => {
            const delay = 6 + i * 4;
            const s = interpolate(frame, [delay, delay + 14], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });
            return (
              <div
                key={`${letter}-${i}`}
                style={{
                  width: 104, height: 128,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid rgba(148,163,184,${0.34 * dissolve})`,
                  background: `rgba(19,29,48,${0.75 * dissolve})`,
                  borderRadius: 10,
                  transform: `translateY(${(1 - s) * 30}px) scale(${0.9 + s * 0.1})`,
                  opacity: s,
                }}
              >
                <span style={{ fontSize: 82, fontWeight: 700, letterSpacing: -2, color: theme.text }}>
                  {letter}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 46, opacity: tagline,
            transform: `translateY(${(1 - tagline) * 18}px)`,
            fontSize: 40, color: theme.muted, fontWeight: 500, letterSpacing: 0.5,
          }}
        >
          Practise real business operations. Earn proof employers can verify.
        </div>
      </AbsoluteFill>
    </Stage>
  );
};
