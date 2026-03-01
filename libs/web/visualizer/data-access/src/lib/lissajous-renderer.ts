// Inspired by https://codepen.io/worenga/pen/DpKVpw

import { COLORS, TWO_PI } from './const';
import { AudioData, VisualizerRenderer } from './visualizer-renderer.interface';

const NUM_POINTS = 500;
const TRAIL_LENGTH = 400;
const BASE_SCALE_RATIO = 0.3;
const GLOW_BLUR = 12;
const SMOOTHING = 0.1;

export class LissajousRenderer implements VisualizerRenderer {
  private phase = 0;
  private freqA = 3;
  private freqB = 2;
  private smoothedEnergy = 0;
  private smoothedPitches: number[] = new Array(12).fill(0);
  private currentBeatPhase = 0;
  private hueOffset = 0;

  setup(width: number, height: number): void {
    this.phase = 0;
    this.freqA = 3;
    this.freqB = 2;
    this.smoothedEnergy = 0;
    this.smoothedPitches = new Array(12).fill(0);
    this.currentBeatPhase = 0;
    this.hueOffset = 0;
  }

  updateAudio(audioData: AudioData): void {
    this.smoothedEnergy += (audioData.energy - this.smoothedEnergy) * SMOOTHING;
    this.currentBeatPhase = audioData.beatPhase;

    for (let i = 0; i < 12; i++) {
      const target = audioData.pitches[i] ?? 0;
      this.smoothedPitches[i] += (target - this.smoothedPitches[i]) * SMOOTHING;
    }

    // Morph frequency ratios based on dominant pitches
    const p0 = this.smoothedPitches[0] + this.smoothedPitches[4] + this.smoothedPitches[7];
    const p1 = this.smoothedPitches[2] + this.smoothedPitches[5] + this.smoothedPitches[9];
    this.freqA += ((2 + p0 * 3) - this.freqA) * 0.02;
    this.freqB += ((3 + p1 * 2) - this.freqB) * 0.02;
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.globalCompositeOperation = 'lighter';

    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) * BASE_SCALE_RATIO;

    // Advance phase
    this.phase += 0.008 + this.smoothedEnergy * 0.01;
    this.hueOffset += 0.5;

    // Beat pulse scale
    const beatPulse = 1.0 + Math.max(0, 1.0 - this.currentBeatPhase * 3) * 0.15 * this.smoothedEnergy;

    // Draw the Lissajous curve
    for (let layer = 0; layer < 2; layer++) {
      const layerPhase = layer * 0.5;
      const layerAlpha = (0.6 - layer * 0.2) * (0.3 + this.smoothedEnergy * 0.7);
      const color = COLORS[Math.floor(this.hueOffset + layer * 5) % COLORS.length];

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 - layer * 0.5;
      ctx.globalAlpha = layerAlpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = GLOW_BLUR * this.smoothedEnergy;

      for (let i = 0; i < TRAIL_LENGTH; i++) {
        const t = (i / NUM_POINTS) * TWO_PI;
        // Lissajous with phase modulation from pitches
        const phaseModX = this.smoothedPitches[1] * 0.5 + this.smoothedPitches[3] * 0.3;
        const phaseModY = this.smoothedPitches[6] * 0.5 + this.smoothedPitches[8] * 0.3;

        const x = cx + Math.sin(this.freqA * t + this.phase + layerPhase + phaseModX) * scale * beatPulse;
        const y = cy + Math.sin(this.freqB * t + this.phase * 0.7 + phaseModY) * scale * beatPulse * 0.8;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
      ctx.restore();
    }
  }

  destroy(): void {
    this.smoothedPitches = [];
  }
}
