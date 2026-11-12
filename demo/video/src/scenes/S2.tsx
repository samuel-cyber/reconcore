import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { CapIcon, CertIcon, JobCardIcon, Label, Stage } from './common';

const Beat: React.FC<{
  start: number; end: number; children: React.ReactNode;
}> = ({ start, end, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [start, start + 12, end - 12, end], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [start, end], [0.97, 1.03], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity, transform: `scale(${scale})` }}>
      {children}
    </AbsoluteFill>
  );
};

/** Problem: a certificate says what you studied, not what you can do. */
export const S2: React.FC = () => {
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const qMark = interpolate(frame, [fps * 10.2, fps * 11.2], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <Stage>
      <Beat start={0} end={fps * 4.6}>
        <CapIcon size={190} color={theme.text} />
        <div style={{ marginTop: 34 }}><Label>Thousands of graduates every year</Label></div>
      </Beat>

      <Beat start={fps * 4.4} end={fps * 9.6}>
        <CertIcon size={190} color={theme.text} />
        <div style={{ marginTop: 34 }}><Label>A certificate says what you studied</Label></div>
      </Beat>

      <Beat start={fps * 9.4} end={fps * 14.4}>
        <div style={{ position: 'relative' }}>
          <JobCardIcon size={190} color={theme.text} />
          <div
            style={{
              position: 'absolute', right: -70, top: -56,
              fontSize: 150, fontWeight: 700, color: theme.amber,
              opacity: qMark, transform: `scale(${0.7 + qMark * 0.3}) rotate(${(1 - qMark) * -12}deg)`,
            }}
          >
            ?
          </div>
        </div>
        <div style={{ marginTop: 34 }}><Label color={theme.amber}>Employers can&apos;t tell who can do the work</Label></div>
      </Beat>
    </Stage>
  );
};
