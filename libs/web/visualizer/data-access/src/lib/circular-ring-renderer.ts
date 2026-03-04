// Inspired by https://codepen.io/TimPietrusky/pen/QWEWLjm

import { COLORS, TWO_PI } from './const';
import { AudioData, VisualizerRenderer } from './visualizer-renderer.interface';

const NUM_POINTS = 128;
const BASE_RADIUS_RATIO = 0.25;
const AMPLITUDE_RATIO = 0.15;
const LINE_WIDTH = 2;
const GLOW_BLUR = 20;
const SMOOTHING = 0.15;

export class CircularRingRenderer implements VisualizerRenderer {
  private smoothedPitches: number[] = new Array(12).fill(0);
  private currentEnergy = 0;
  private currentBeatPhase = 0;
  private rotation = 0;
  private colorIndex = 0;

  setup(width: number, height: number): void {
    this.smoothedPitches = new Array(12).fill(0);
    this.currentEnergy = 0;
    this.currentBeatPhase = 0;
    this.rotation = 0;
    this.colorIndex = 0;
  }

  updateAudio(audioData: AudioData): void {
    this.currentEnergy = audioData.energy;
    this.currentBeatPhase = audioData.beatPhase;

    for (let i = 0; i < 12; i++) {
      const target = audioData.pitches[i] ?? 0;
      this.smoothedPitches[i] += (target - this.smoothedPitches[i]) * SMOOTHING;
    }
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.globalCompositeOperation = 'lighter';

    const cx = width / 2;
    const cy = height / 2;
    const minDim = Math.min(width, height);
    const baseRadius = minDim * BASE_RADIUS_RATIO;
    const amplitude = minDim * AMPLITUDE_RATIO;

    // Slow rotation
    this.rotation += 0.003;

    // Beat pulse
    const beatPulse = 1.0 + Math.max(0, 1.0 - this.currentBeatPhase * 3) * 0.1 * this.currentEnergy;

    // Draw multiple rings with slight offsets for depth
    for (let ring = 0; ring < 3; ring++) {
      const ringOffset = ring * 0.15;
      const ringAlpha = (0.7 - ring * 0.2) * (0.3 + this.currentEnergy * 0.7);
      const ringRadius = baseRadius * (1 + ring * 0.3) * beatPulse;
      const color = COLORS[Math.floor(this.colorIndex + ring * 4) % COLORS.length];

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = LINE_WIDTH;
      ctx.globalAlpha = ringAlpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = GLOW_BLUR * this.currentEnergy;

      for (let i = 0; i <= NUM_POINTS; i++) {
        const angle = (i / NUM_POINTS) * TWO_PI + this.rotation + ringOffset;
        // Interpolate between the 12 pitch values smoothly
        const pitchPos = (i / NUM_POINTS) * 12;
        const pitchIdx = Math.floor(pitchPos) % 12;
        const nextIdx = (pitchIdx + 1) % 12;
        const frac = pitchPos - Math.floor(pitchPos);
        const pitchValue = this.smoothedPitches[pitchIdx] * (1 - frac) + this.smoothedPitches[nextIdx] * frac;

        const distortion = pitchValue * amplitude * this.currentEnergy * 2;
        const r = ringRadius + distortion;

        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    // Update color slowly
    this.colorIndex = (this.colorIndex + 0.01) % COLORS.length;
  }

  destroy(): void {
    this.smoothedPitches = [];
  }
}
