// Audio visualization originally created by Justin Windle (@soulwire)
// as seen on https://codepen.io/soulwire/pen/Dscga
// also seen on https://github.com/koel/core/blob/master/js/utils/visualizer.ts by @phanan

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../typings/sketch-js.d.ts" />

import * as Sketch from 'sketch-js';
import { VisualizerType } from './const';
import { CircularRingRenderer } from './circular-ring-renderer';
import { LissajousRenderer } from './lissajous-renderer';
import { ParticlesRenderer } from './particles-renderer';
import { RadialSpikesRenderer } from './radial-spikes-renderer';
import { SoundLinesRenderer } from './sound-lines-renderer';
import { AudioData, VisualizerRenderer } from './visualizer-renderer.interface';
import { WaveformBarsRenderer } from './waveform-bars-renderer';

export function createRenderer(type: VisualizerType): VisualizerRenderer {
  switch (type) {
    case VisualizerType.WaveformBars:
      return new WaveformBarsRenderer();
    case VisualizerType.CircularRing:
      return new CircularRingRenderer();
    case VisualizerType.Lissajous:
      return new LissajousRenderer();
    case VisualizerType.RadialSpikes:
      return new RadialSpikesRenderer();
    case VisualizerType.SoundLines:
      return new SoundLinesRenderer();
    case VisualizerType.Particles:
    default:
      return new ParticlesRenderer();
  }
}

export interface VisualizerInstance {
  sketch: Sketch.Sketch;
  renderer: VisualizerRenderer;
  setRenderer: (type: VisualizerType) => VisualizerRenderer;
  updateAudio: (audioData: AudioData) => void;
}

export const initVisualizer = (
  container: HTMLElement,
  type: VisualizerType = VisualizerType.Particles
): VisualizerInstance => {
  let renderer = createRenderer(type);

  const sketch = Sketch.create({
    container,
    autopause: false,
    setup() {
      renderer.setup(this.width, this.height);
    },
    draw() {
      renderer.draw(this, container.clientWidth, container.clientHeight);
    }
  });

  const setRenderer = (newType: VisualizerType): VisualizerRenderer => {
    renderer.destroy();
    renderer = createRenderer(newType);
    renderer.setup(container.clientWidth, container.clientHeight);
    return renderer;
  };

  const updateAudio = (audioData: AudioData): void => {
    renderer.updateAudio(audioData);
  };

  return {
    sketch,
    renderer,
    setRenderer,
    updateAudio
  };
};
