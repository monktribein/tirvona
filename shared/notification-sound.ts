const PREFERENCE_KEY = "tradevistar:notification-sound-enabled";

let audioContext: AudioContext | null = null;

export function notificationSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREFERENCE_KEY) === "true";
}

export function rememberNotificationSound(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFERENCE_KEY, String(enabled));
}

/** A short built-in two-tone chime, used when Admin has not uploaded a custom sound. */
export async function playDefaultNotificationSound(): Promise<void> {
  const AudioContextCtor = window.AudioContext;
  audioContext ??= new AudioContextCtor();
  if (audioContext.state === "suspended") await audioContext.resume();

  const startedAt = audioContext.currentTime;
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, startedAt);
  gain.gain.exponentialRampToValueAtTime(0.16, startedAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.42);
  gain.connect(audioContext.destination);

  [740, 988].forEach((frequency, index) => {
    const oscillator = audioContext!.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(startedAt + index * 0.1);
    oscillator.stop(startedAt + 0.32 + index * 0.1);
  });
}
