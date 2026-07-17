import React from 'react';

const STORAGE_KEY = 'sivacad_sound_enabled';
const SOUND_EVENT = 'sivacad:sound-change';

let audioContext = null;

function isBrowser() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readStoredSoundPreference() {
  if (!isBrowser()) return true;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true;

  return stored !== '0' && stored !== 'false';
}

export function isSoundEnabled() {
  return readStoredSoundPreference();
}

function emitSoundChange(enabled) {
  if (!isBrowser()) return;

  window.dispatchEvent(
    new CustomEvent(SOUND_EVENT, {
      detail: { enabled }
    })
  );
}

export function setSoundEnabled(enabled) {
  if (!isBrowser()) return false;

  const nextValue = Boolean(enabled);
  localStorage.setItem(STORAGE_KEY, nextValue ? '1' : '0');
  emitSoundChange(nextValue);
  return nextValue;
}

export function toggleSoundEnabled() {
  const nextValue = !readStoredSoundPreference();
  return setSoundEnabled(nextValue);
}

export function subscribeSoundChanges(callback) {
  if (!isBrowser()) return () => {};

  const handler = () => callback();

  window.addEventListener('storage', handler);
  window.addEventListener(SOUND_EVENT, handler);

  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(SOUND_EVENT, handler);
  };
}

export function useSoundEnabled() {
  const subscribe = React.useCallback(
    (notify) => subscribeSoundChanges(notify),
    []
  );

  const getSnapshot = React.useCallback(() => readStoredSoundPreference(), []);

  if (typeof React.useSyncExternalStore === 'function') {
    return React.useSyncExternalStore(subscribe, getSnapshot, () => true);
  }

  const [enabled, setEnabled] = React.useState(() => getSnapshot());

  React.useEffect(() => {
    const unsubscribe = subscribe(() => setEnabled(getSnapshot()));
    return unsubscribe;
  }, [subscribe, getSnapshot]);

  return enabled;
}

function getAudioContext() {
  if (!isBrowser()) return null;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

export async function prepareSound() {
  const ctx = getAudioContext();
  if (!ctx) return null;

  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      // algunos navegadores bloquean audio hasta interacción del usuario
    }
  }

  return ctx;
}

function playTone(
  ctx,
  { frequency, duration = 140, gain = 0.03, type = 'sine', delay = 0 }
) {
  try {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();

    const start = ctx.currentTime + delay;
    const end = start + duration / 1000;

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);

    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0001), start + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(amp);
    amp.connect(ctx.destination);

    osc.start(start);
    osc.stop(end + 0.05);
  } catch {
    // no rompe el flujo si el navegador bloquea el audio
  }
}

async function playSequence(sequence) {
  if (!readStoredSoundPreference()) return;

  const ctx = await prepareSound();
  if (!ctx) return;

  sequence.forEach((tone) => playTone(ctx, tone));
}

export async function playSuccessSound() {
  await playSequence([
    { frequency: 523.25, duration: 120, gain: 0.028, type: 'sine', delay: 0 },
    { frequency: 659.25, duration: 150, gain: 0.026, type: 'sine', delay: 0.13 }
  ]);
}

export async function playErrorSound() {
  await playSequence([
    { frequency: 220, duration: 160, gain: 0.028, type: 'sine', delay: 0 },
    { frequency: 196, duration: 180, gain: 0.026, type: 'sine', delay: 0.16 }
  ]);
}

export async function playNotificationSound() {
  await playSequence([
    { frequency: 587.33, duration: 100, gain: 0.024, type: 'sine', delay: 0 },
    { frequency: 783.99, duration: 110, gain: 0.022, type: 'sine', delay: 0.12 }
  ]);
}