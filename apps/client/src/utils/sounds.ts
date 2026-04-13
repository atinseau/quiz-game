const soundWin = new Audio("/win.mp3");
const soundFail = new Audio("/fail.mp3");
const soundSteal = new Audio("/steal.mp3");

function play(audio: HTMLAudioElement) {
  audio.currentTime = 0;
  audio.play();
}

export const sounds = {
  win: () => play(soundWin),
  fail: () => play(soundFail),
  steal: () => play(soundSteal),
};
