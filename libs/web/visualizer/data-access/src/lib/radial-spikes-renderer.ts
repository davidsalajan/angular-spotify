// Inspired by https://codepen.io/MyXoToD/pen/JYJGvG

import { COLORS, TWO_PI } from './const';
import { AudioData, VisualizerRenderer } from './visualizer-renderer.interface';

const NUM_SPIKES = 48;
const INNER_RADIUS_RATIO = 0.08;
const MAX_SPIKE_RATIO = 0.3;
const GLOW_BLUR = 15;
const SMOOTHING = 0.2;
const LINE_WIDTH = 2;
const ROTATION_SPEED = 0.005;
const MIN_SPIKE_RATIO = 0.04; // minimum spike length ratio
const WAVE_SPEED = 0.05; // speed of the rotating wave pattern

export class RadialSpikesRenderer implements VisualizerRenderer {
  private smoothedValues: number[] = new Array(NUM_SPIKES).fill(0);
  private currentEnergy = 0;
  private currentBeatPhase = 0;
  private rotation = 0;
  private time = 0;

  setup(width: number, height: number): void {
    this.smoothedValues = new Array(NUM_SPIKES).fill(0);
    this.currentEnergy = 0;
    this.currentBeatPhase = 0;
    this.rotation = 0;
    this.time = 0;
  }

  updateAudio(audioData: AudioData): void {
    this.currentEnergy = audioData.energy;
    this.currentBeatPhase = audioData.beatPhase;

    // Map 12 pitches to 48 spikes via interpolation
    for (let i = 0; i < NUM_SPIKES; i++) {
      const pitchPos = (i / NUM_SPIKES) * 12;
      const pitchIdx = Math.floor(pitchPos) % 12;
      const nextIdx = (pitchIdx + 1) % 12;
      const frac = pitchPos - Math.floor(pitchPos);
      const target = (audioData.pitches[pitchIdx] ?? 0) * (1 - frac) +
                     (audioData.pitches[nextIdx] ?? 0) * frac;
      this.smoothedValues[i] += (target - this.smoothedValues[i]) * SMOOTHING;
    }
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.globalCompositeOperation = 'lighter';

    const cx = width / 2;
    const cy = height / 2;
    const minDim = Math.min(width, height);
    const innerRadius = minDim * INNER_RADIUS_RATIO;
    const maxSpike = minDim * MAX_SPIKE_RATIO;

    // Continuous rotation
    this.rotation += ROTATION_SPEED;
    this.time += WAVE_SPEED;

    // Beat pulse
    const beatPulse = 1.0 + Math.max(0, 1.0 - this.currentBeatPhase * 3) * 0.15 * this.currentEnergy;
    const minSpike = minDim * MIN_SPIKE_RATIO;

    for (let i = 0; i < NUM_SPIKES; i++) {
      const angle = (i / NUM_SPIKES) * TWO_PI + this.rotation;
      const value = this.smoothedValues[i] * this.currentEnergy * 2;
      // Per-spike wave animation: rotating wave pattern for continuous motion
      const waveMotion = minSpike * (0.5 + 0.5 * Math.sin(this.time + i * TWO_PI / NUM_SPIKES));
      const spikeLength = innerRadius + waveMotion + value * maxSpike * beatPulse;
      const color = COLORS[i % COLORS.length];

      const x1 = cx + Math.cos(angle) * innerRadius;
      const y1 = cy + Math.sin(angle) * innerRadius;
      const x2 = cx + Math.cos(angle) * spikeLength;
      const y2 = cy + Math.sin(angle) * spikeLength;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = LINE_WIDTH + value * 2;
      ctx.globalAlpha = 0.3 + this.currentEnergy * 0.7;
      ctx.shadowColor = color;
      ctx.shadowBlur = GLOW_BLUR * this.currentEnergy;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // Draw inner circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius * beatPulse, 0, TWO_PI);
    ctx.strokeStyle = COLORS[0];
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3 + this.currentEnergy * 0.5;
    ctx.shadowColor = COLORS[0];
    ctx.shadowBlur = GLOW_BLUR * this.currentEnergy * 0.5;
    ctx.stroke();
    ctx.restore();
  }

  destroy(): void {
    this.smoothedValues = [];
  }
}
