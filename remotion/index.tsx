import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { RankReel, rankReelDuration, defaultProps } from './RankReel';

const Root: React.FC = () => (
  <Composition
    id="RankReel"
    component={RankReel as any}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={defaultProps as any}
    calculateMetadata={({ props }: any) => ({ durationInFrames: rankReelDuration(props) })}
  />
);

registerRoot(Root);
