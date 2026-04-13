// Provide browser globals that don't exist in Bun's test runtime
globalThis.Audio = class Audio {
  src = "";
  currentTime = 0;
  constructor(src?: string) {
    if (src) this.src = src;
  }
  play() {
    return Promise.resolve();
  }
  pause() {}
} as unknown as typeof globalThis.Audio;
