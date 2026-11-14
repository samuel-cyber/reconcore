import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';

export type ZoomKey = { at: number; scale: number; ox: number; oy: number };

const pad = (n: number) => String(n).padStart(4, '0');

/**
 * Slow push-in over a screen recording, aimed at the part being narrated.
 *
 * The recordings are served as JPEG frame sequences rather than through
 * <OffthreadVideo>: Remotion's frame extractor failed deterministically mid-clip on this
 * machine, and still images render faster and cannot fail that way.
 */
export const ZoomClip: React.FC<{
  clipId: string;
  frameCount: number;
  keys: ZoomKey[];
  fps: number;
}> = ({ clipId, frameCount, keys, fps }) => {
  const frame = useCurrentFrame();
  const stops = keys.map((k) => k.at * fps);
  const opts = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
  const scale = interpolate(frame, stops, keys.map((k) => k.scale), opts);
  const ox = interpolate(frame, stops, keys.map((k) => k.ox), opts);
  const oy = interpolate(frame, stops, keys.map((k) => k.oy), opts);
  const index = Math.min(Math.max(frame, 0), frameCount - 1) + 1;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#070B14' }}>
      <Img
        src={staticFile(`frames/${clipId}/${pad(index)}.jpg`)}
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
