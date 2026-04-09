import { COLORS, TWO_PI } from './const';
import { AudioData, VisualizerRenderer } from './visualizer-renderer.interface';

const NUM_BUBBLES = 40;
const SMOOTHING = 0.12;
const MIN_RADIUS = 8;
const MAX_RADIUS = 50;
const DRIFT_SPEED = 0.3;

interface Bubble {
  x: number;
  y: number;
  baseRadius: number;
  radius: number;
  targetRadius: number;
  vx: number;
  vy: number;
  color: string;
  phase: number;
}

export class BubblesRenderer implements VisualizerRenderer {
  private bubbles: Bubble[] = [];
  private width = 0;
  private height = 0;
  private currentEnergy = 0;
  private currentBeatPhase = 0;
  private currentPitches: number[] = new Array(12).fill(0);
  private time = 0;

  setup(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.time = 0;
    this.currentEnergy = 0;
    this.currentBeatPhase = 0;
    this.currentPitches = new Array(12).fill(0);
    this.bubbles = [];

    for (let i = 0; i < NUM_BUBBLES; i++) {
      this.bubbles.push(this.createBubble(
        Math.random() * width,
        Math.random() * height
      ));
    }
  }

  private createBubble(x: number, y: number): Bubble {
    const baseRadius = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS) * 0.5;
    return {
      x,
      y,
      baseRadius,
      radius: baseRadius,
      targetRadius: baseRadius,
      vx: (Math.random() - 0.5) * DRIFT_SPEED,
      vy: (Math.random() - 0.5) * DRIFT_SPEED - 0.2, // slight upward bias
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      phase: Math.random() * TWO_PI
    };
  }

  updateAudio(audioData: AudioData): void {
    // Smooth energy interpolation
    this.currentEnergy += (audioData.energy - this.currentEnergy) * SMOOTHING;
    this.currentBeatPhase = audioData.beatPhase;

    for (let i = 0; i < 12; i++) {
      this.currentPitches[i] += ((audioData.pitches[i] ?? 0) - this.currentPitches[i]) * SMOOTHING;
    }

    // Update bubble target radii based on energy
    for (let i = 0; i < this.bubbles.length; i++) {
      const bubble = this.bubbles[i];
      const pitchIdx = i % 12;
      const pitchInfluence = this.currentPitches[pitchIdx];
      bubble.targetRadius = bubble.baseRadius * (0.5 + this.currentEnergy * 1.5 + pitchInfluence * 0.5);
      bubble.color = COLORS[(Math.floor(pitchIdx + this.currentEnergy * 5)) % COLORS.length];
    }
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.time += 0.02;

    ctx.globalCompositeOperation = 'lighter';

    // Beat pulse: brief size bump at beat start
    const beatPulse = 1.0 + Math.max(0, 1.0 - this.currentBeatPhase * 4) * 0.15;

    for (const bubble of this.bubbles) {
      // Asymmetric radius smoothing: fast grow, slow shrink
      const radiusDiff = bubble.targetRadius * beatPulse - bubble.radius;
      const radiusSpeed = radiusDiff > 0 ? 0.2 : 0.08;
      bubble.radius += radiusDiff * radiusSpeed;

      // Idle breathing oscillation
      const breath = 1 + Math.sin(this.time * 1.5 + bubble.phase) * 0.08;
      const drawRadius = bubble.radius * breath;

      // Drift movement
      bubble.x += bubble.vx + Math.sin(this.time + bubble.phase) * 0.3;
      bubble.y += bubble.vy + Math.cos(this.time * 0.7 + bubble.phase) * 0.2;

      // Wrap around edges
      if (bubble.x < -drawRadius) bubble.x = this.width + drawRadius;
      if (bubble.x > this.width + drawRadius) bubble.x = -drawRadius;
      if (bubble.y < -drawRadius) bubble.y = this.height + drawRadius;
      if (bubble.y > this.height + drawRadius) bubble.y = -drawRadius;

      // Draw bubble with radial gradient for translucency
      ctx.save();
      const gradient = ctx.createRadialGradient(
        bubble.x, bubble.y, 0,
        bubble.x, bubble.y, drawRadius
      );
      gradient.addColorStop(0, bubble.color + 'AA'); // semi-transparent center
      gradient.addColorStop(0.6, bubble.color + '44');
      gradient.addColorStop(1, bubble.color + '00'); // fully transparent edge

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, drawRadius, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
  }

  destroy(): void {
    this.bubbles = [];
  }
}
