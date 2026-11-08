/** Frame-time instrumentation used for the 60fps budget checks. */
const MAX_SAMPLES = 240;

class Perf {
  private samples: number[] = [];
  fpsValue = 60;
  drawCalls = 0;

  sample(deltaMs: number): void {
    if (deltaMs <= 0 || deltaMs > 1000) return;
    this.samples.push(deltaMs);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    this.fpsValue = avg > 0 ? 1000 / avg : 0;
  }

  reset(): void {
    this.samples = [];
  }

  summary(): { fps: number; minFps: number; p95FrameMs: number; samples: number } {
    if (this.samples.length === 0) return { fps: 60, minFps: 60, p95FrameMs: 16.7, samples: 0 };
    const sorted = [...this.samples].sort((a, b) => a - b);
    const avg = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1]!;
    const worst = sorted[sorted.length - 1]!;
    return {
      fps: 1000 / avg,
      minFps: 1000 / worst,
      p95FrameMs: p95,
      samples: this.samples.length,
    };
  }
}

export const perf = new Perf();
