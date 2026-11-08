import Phaser from 'phaser';
import './styles.css';
import { COLORS } from './core/config';
import { perf } from './perf';
import { MapScene } from './scenes/MapScene';
import { Ui } from './ui/Ui';

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.bg,
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: {
    antialias: true,
    powerPreference: 'high-performance',
  },
  fps: { target: 60, forceSetTimeOut: false },
  input: { activePointers: 3 },
  scene: [MapScene],
};

new Phaser.Game(gameConfig);

// The UI lives above the canvas in the DOM layer.
new Ui();

// PWA: offline play after the first visit (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is best-effort */
    });
  });
}

declare global {
  interface Window {
    __choke?: {
      game: unknown;
      scene: MapScene;
      perf: typeof perf;
      stats: () => Record<string, number>;
      panBench: (ms?: number) => Promise<{
        fps: number;
        minFps: number;
        p95FrameMs: number;
        samples: number;
        stats: Record<string, number>;
      }>;
    };
  }
}
