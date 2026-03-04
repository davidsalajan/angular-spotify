export interface AudioData {
  energy: number;       // 0-1, normalized from segment loudness_max
  pitches: number[];    // 12 pitch classes from current segment (0-1 each)
  timbre: number[];     // 12 timbre coefficients from current segment
  tempo: number;        // BPM from track analysis
  beatPhase: number;    // 0-1, position within current beat cycle
}

export interface VisualizerRenderer {
  setup(width: number, height: number): void;
  updateAudio(audioData: AudioData): void;
  draw(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  destroy(): void;
}
