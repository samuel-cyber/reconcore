import React from 'react';
import { AbsoluteFill, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from 'remotion';

export type ZoomKey = { at: number; scale: number; ox: number; oy: number };

/** Slow push-in over a screen recording, aimed at the part being narrated. */
export const ZoomClip: React.FC<{ src: string; keys: ZoomKey[]; fps: number }> = ({ src, keys, fps }) => {
  const frame = useCurrentFrame();
  const stops = keys.map((k) => k.at * fps);
  const opts = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
  const scale = interpolate(frame, stops, keys.map((k) => k.scale), opts);
  const ox = interpolate(frame, stops, keys.map((k) => k.ox), opts);
  const oy = interpolate(frame, stops, keys.map((k) => k.oy), opts);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#070B14' }}>
      <OffthreadVideo
        src={staticFile(src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale})`,
          transformOrigin: `${ox}% ${oy}%`,
        }}
      />
    </AbsoluteFill>
  );
};
