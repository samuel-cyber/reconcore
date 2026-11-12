import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { theme } from './theme';

export type Cue = { text: string; from: number; duration: number };

/** Burned-in captions: bottom third, two lines max, high contrast. */
export const Captions: React.FC<{ cues: Cue[] }> = ({ cues }) => {
  const frame = useCurrentFrame();
  const cue = cues.find((c) => frame >= c.from && frame < c.from + c.duration);
  if (!cue) return null;

  const local = frame - cue.from;
  const opacity = interpolate(
    local,
    [0, 5, cue.duration - 5, cue.duration],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const lift = interpolate(local, [0, 8], [10, 0], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 72 }}>
      <div
        style={{
          opacity,
          transform: `translateY(${lift}px)`,
          maxWidth: 1340,
          padding: '20px 36px',
          borderRadius: 18,
          background: 'rgba(6,10,18,0.82)',
          border: `1px solid ${theme.line}`,
          boxShadow: '0 18px 50px rgba(0,0,0,0.45)',
          fontFamily: theme.sans,
          fontWeight: 500,
          fontSize: 40,
          lineHeight: 1.3,
          color: theme.text,
          textAlign: 'center',
          textWrap: 'balance',
        }}
      >
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};
