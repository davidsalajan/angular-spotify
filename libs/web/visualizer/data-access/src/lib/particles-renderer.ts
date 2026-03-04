import { random } from 'lodash-es';
import { NUM_PARTICLES } from './const';
import { Particle } from './particle';
import { AudioData, VisualizerRenderer } from './visualizer-renderer.interface';

export class ParticlesRenderer implements VisualizerRenderer {
  private particles: Particle[] = [];
  private width = 0;
  private height = 0;

  setup(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.particles = [];

    for (let i = 0; i < NUM_PARTICLES; i++) {
      const particle = new Particle(random(width), random(height));
      particle.energy = random(particle.band / 256);
      this.particles.push(particle);
    }
  }

  updateAudio(audioData: AudioData): void {
    for (const particle of this.particles) {
      particle.energy = audioData.energy;
    }
  }

  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.width = width;
    this.height = height;
    ctx.globalCompositeOperation = 'lighter';

    for (const particle of this.particles) {
      if (particle.y < -particle.size * particle.level * particle.scale * 2) {
        particle.reset();
        particle.x = random(this.width);
        particle.y = this.height + particle.size * particle.scale * particle.level * 2;
      }

      particle.move();
      particle.draw(ctx);
    }
  }

  destroy(): void {
    this.particles = [];
  }
}
