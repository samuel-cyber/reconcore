import React from 'react';
import { AbsoluteFill, Audio, Composition, Sequence, staticFile } from 'remotion';
import timeline from './timeline.json';
import { Captions, type Cue } from './Captions';
import { Fonts } from './Fonts';
import { ZoomClip, type ZoomKey } from './ZoomClip';
import { theme } from './theme';
import { S1 } from './scenes/S1';
import { S2 } from './scenes/S2';
import { S3 } from './scenes/S3';
import { S7 } from './scenes/S7';
import { S9 } from './scenes/S9';

const ANIMATIONS: Record<string, React.FC> = { s1: S1, s2: S2, s3: S3, s7: S7, s9: S9 };

/** Where each screen scene pushes in, in seconds and % of frame. */
const ZOOMS: Record<string, ZoomKey[]> = {
  // brief -> tabs -> the messy date column -> the messy amount column
  s4: [
    { at: 0, scale: 1.0, ox: 50, oy: 50 },
    { at: 6, scale: 1.1, ox: 22, oy: 40 },
    { at: 13, scale: 1.14, ox: 55, oy: 42 },
    { at: 20, scale: 1.26, ox: 37, oy: 44 },
    { at: 28, scale: 1.35, ox: 64, oy: 46 },
  ],
  // the form being filled -> the red fields -> the tutor's question
  s5: [
    { at: 0, scale: 1.04, ox: 16, oy: 72 },
    { at: 8, scale: 1.22, ox: 15, oy: 76 },
    { at: 14, scale: 1.26, ox: 15, oy: 70 },
    { at: 19, scale: 1.3, ox: 88, oy: 40 },
    { at: 26.5, scale: 1.35, ox: 88, oy: 44 },
  ],
  // the form -> all three green -> the credential
  s6: [
    { at: 0, scale: 1.06, ox: 15, oy: 74 },
    { at: 7, scale: 1.24, ox: 15, oy: 72 },
    { at: 12, scale: 1.12, ox: 50, oy: 50 },
    { at: 20, scale: 1.28, ox: 50, oy: 46 },
  ],
  // the credential JSON -> green verification -> the red tamper result
  s8: [
    { at: 0, scale: 1.08, ox: 50, oy: 48 },
    { at: 9, scale: 1.3, ox: 48, oy: 58 },
    { at: 17, scale: 1.24, ox: 38, oy: 62 },
    { at: 24, scale: 1.3, ox: 52, oy: 64 },
    { at: 30, scale: 1.35, ox: 52, oy: 64 },
  ],
};

const Scene: React.FC<{ scene: (typeof timeline.scenes)[number]; fps: number }> = ({ scene, fps }) => {
  const Animation = ANIMATIONS[scene.id];
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      {scene.kind === 'screen' ? (
        <ZoomClip
          clipId={scene.id}
          frameCount={scene.frameCount ?? scene.durationInFrames}
          keys={ZOOMS[scene.id]}
          fps={fps}
        />
      ) : (
        Animation && <Animation />
      )}
      <Audio src={staticFile(scene.audio)} />
      <Captions cues={scene.captions as Cue[]} />
    </AbsoluteFill>
  );
};

export const Demo: React.FC = () => {
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <Fonts />
      {timeline.scenes.map((scene) => {
        const element = (
          <Sequence key={scene.id} from={from} durationInFrames={scene.durationInFrames} name={scene.id}>
            <Scene scene={scene} fps={timeline.fps} />
          </Sequence>
        );
        from += scene.durationInFrames;
        return element;
      })}
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="ReconCoreDemo"
      component={Demo}
      durationInFrames={timeline.totalFrames}
      fps={timeline.fps}
      width={timeline.width}
      height={timeline.height}
    />
  </>
);
