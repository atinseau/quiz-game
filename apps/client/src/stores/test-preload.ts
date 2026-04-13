// Preload for tests: polyfill browser globals
globalThis.Audio = class Audio {
  src = "";
  currentTime = 0;
  constructor(src?: string) {
    this.src = src ?? "";
  }
  play() {
    return Promise.resolve();
  }
  pause() {}
} as any;
