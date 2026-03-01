import { COLORS } from './const';
import { AudioData, VisualizerRenderer } from './visualizer-renderer.interface';

const NUM_BARS = 12;
const RISE_SPEED = 0.3; // how fast bars rise toward target
const FALL_SPEED = 0.3; // how fast bars fall back down (slower = smoother)
const GLOW_BLUR = 15;
const BAR_GAP_RATIO = 0.3; // gap between bars as ratio of bar width
const MAX_HEIGHT_RATIO = 0.85; // max bar height as ratio of canvas height
const MIN_HEIGHT_RATIO = 0.02; // min bar height to always show something
const REFLECTION_ALPHA = 0.15;
const REFLECTION_HEIGHT_RATIO = 0.3;

export class WaveformBarsRenderer implements VisualizerRenderer {
  private currentHeights: number[] = new Array(NUM_BARS).fill(0);
  private targetHeights: number[] = new Array(NUM_BARS).fill(0);
  private currentEnergy = 0;
  private currentBeatPhase = 0;
  private barColors: string[] = [];

  setup(width: number, height: number): void {
    this.currentHeights = new Array(NUM_BARS).fill(0);
    this.targetHeights = new Array(NUM_BARS).fill(0);
    this.currentEnergy = 0;
    this.currentBeatPhase = 0;
    // Assign colors from the palette, cycling if needed
    this.barColors = Array.from({ length: NUM_BARS }, (_, i) => COLORS[i % COLORS.length]);
  }

  updateAudio(audioData: AudioData): void {
    this.currentEnergy = audioData.energy;
    this.currentBeatPhase = audioData.beatPhase;

    for (let i = 0; i < NUM_BARS; i++) {
      const pitch = audioData.pitches[i] ?? 0;
      this.targetHeights[i] = pitch * (0.3 + audioData.energy * 0.7);
    }
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.globalCompositeOperation = 'lighter';

    const totalBarSpace = width * 0.8; // use 80% of width
    const startX = (width - totalBarSpace) / 2;
    const barWidth = totalBarSpace / (NUM_BARS * (1 + BAR_GAP_RATIO));
    const gap = barWidth * BAR_GAP_RATIO;
    const baseY = height * 0.85; // bars grow from 85% of height upward

    // Beat pulse - subtle scale bump at beat start
    const beatPulse = 1.0 + Math.max(0, 1.0 - this.currentBeatPhase * 4) * 0.08;

    for (let i = 0; i < NUM_BARS; i++) {
      // Smooth lerp: rise fast, fall gently
      const diff = this.targetHeights[i] - this.currentHeights[i];
      const speed = diff > 0 ? RISE_SPEED : FALL_SPEED;
      this.currentHeights[i] += diff * speed;

      const barHeight = Math.max(
        height * MIN_HEIGHT_RATIO,
        this.currentHeights[i] * height * MAX_HEIGHT_RATIO * beatPulse
      );

      const x = startX + i * (barWidth + gap);
      const y = baseY - barHeight;

      // Main bar with glow
      ctx.save();
      ctx.shadowColor = this.barColors[i];
      ctx.shadowBlur = GLOW_BLUR * this.currentEnergy;
      ctx.fillStyle = this.barColors[i];
      ctx.globalAlpha = 0.6 + this.currentEnergy * 0.4;

      // Rounded top corners
      const radius = Math.min(barWidth / 2, 4);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + barWidth - radius, y);
      ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
      ctx.lineTo(x + barWidth, baseY);
      ctx.lineTo(x, baseY);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();

      // Reflection below baseline
      ctx.shadowBlur = 0;
      ctx.globalAlpha = REFLECTION_ALPHA * this.currentEnergy;
      const reflectionHeight = barHeight * REFLECTION_HEIGHT_RATIO;
      ctx.fillRect(x, baseY, barWidth, reflectionHeight);

      ctx.restore();
    }
  }

  destroy(): void {
    this.currentHeights = [];
    this.targetHeights = [];
  }
}
