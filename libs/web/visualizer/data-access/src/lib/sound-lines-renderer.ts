// Inspired by https://codepen.io/soleneramis/pen/dQYwGa

import { COLORS, TWO_PI } from './const';
import { AudioData, VisualizerRenderer } from './visualizer-renderer.interface';

const NUM_LINES = 24;
const POINTS_PER_LINE = 100;
const MAX_AMPLITUDE = 40;
const SMOOTHING = 0.12;
const LINE_SPACING_RATIO = 0.6;
const BASE_PHASE_SPEED = 0.05; // always visibly moving
const ENERGY_PHASE_BOOST = 0.02; // energy adds speed, doesn't gate it
const MIN_AMP_FACTOR = 0.15; // minimum amplitude floor

export class SoundLinesRenderer implements VisualizerRenderer {
  private smoothedPitches: number[] = new Array(12).fill(0);
  private currentEnergy = 0;
  private currentBeatPhase = 0;
  private phase = 0;
  private driftPhase = 0; // secondary slow drift for organic feel

  setup(width: number, height: number): void {
    this.smoothedPitches = new Array(12).fill(0);
    this.currentEnergy = 0;
    this.currentBeatPhase = 0;
    this.phase = 0;
    this.driftPhase = 0;
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

    this.phase += BASE_PHASE_SPEED + this.currentEnergy * ENERGY_PHASE_BOOST;
    this.driftPhase += 0.013; // slow secondary drift for organic feel

    const totalHeight = height * LINE_SPACING_RATIO;
    const startY = (height - totalHeight) / 2;
    const lineGap = totalHeight / (NUM_LINES - 1);

    // Beat pulse
    const beatBoost = Math.max(0, 1.0 - this.currentBeatPhase * 3) * this.currentEnergy;

    for (let line = 0; line < NUM_LINES; line++) {
      const baseY = startY + line * lineGap;
      const lineRatio = line / (NUM_LINES - 1);
      // Each line is influenced by a mix of pitch values
      const pitchIdx1 = Math.floor(lineRatio * 11);
      const pitchIdx2 = Math.min(11, pitchIdx1 + 1);
      const pitchMix = lineRatio * 11 - pitchIdx1;
      const pitchInfluence = this.smoothedPitches[pitchIdx1] * (1 - pitchMix) +
                             this.smoothedPitches[pitchIdx2] * pitchMix;

      // Minimum amplitude floor so waves always undulate visibly
      const amp = MAX_AMPLITUDE * (MIN_AMP_FACTOR + pitchInfluence * 1.5 + this.currentEnergy * 0.5) * (1 + beatBoost * 0.5);
      const color = COLORS[line % COLORS.length];

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.3 + this.currentEnergy * 0.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 * this.currentEnergy;

      for (let p = 0; p <= POINTS_PER_LINE; p++) {
        const x = (p / POINTS_PER_LINE) * width;
        const xRatio = p / POINTS_PER_LINE;

        // Envelope: fade at edges
        const envelope = Math.sin(xRatio * Math.PI);

        // Multiple sine harmonics for richness
        const freq1 = 2 + pitchIdx1 * 0.5;
        const freq2 = 3 + pitchIdx2 * 0.3;
        const wave = Math.sin(xRatio * TWO_PI * freq1 + this.phase + line * 0.4) * 0.6 +
                     Math.sin(xRatio * TWO_PI * freq2 + this.phase * 1.3 + line * 0.2) * 0.3 +
                     Math.sin(xRatio * TWO_PI * 1.5 + this.driftPhase + line * 0.7) * 0.1;

        const y = baseY + wave * amp * envelope;

        if (p === 0) {
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
