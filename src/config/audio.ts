import type { AudioSettings } from '../types';

export const AUDIO_CHAIN_DEFAULTS: Readonly<AudioSettings> = Object.freeze({
  loop: true,
  elementVolume: 1,
  initialGain: 0.25,
  fadeTargetGain: 0.65,
  sustainGain: 0.6,
  fadeDuration: 6,
});

export const HOME_AUDIO_CONFIG = {
  src: '/assets/audio/home/home-theme.mp3',
  label: 'Tema principale della Relata',
} as const;

export function resolveAudioSettings(overrides: Partial<AudioSettings> = {}): AudioSettings {
  return {
    loop: overrides.loop ?? AUDIO_CHAIN_DEFAULTS.loop,
    elementVolume: overrides.elementVolume ?? AUDIO_CHAIN_DEFAULTS.elementVolume,
    initialGain: overrides.initialGain ?? AUDIO_CHAIN_DEFAULTS.initialGain,
    fadeTargetGain: overrides.fadeTargetGain ?? AUDIO_CHAIN_DEFAULTS.fadeTargetGain,
    sustainGain: overrides.sustainGain ?? AUDIO_CHAIN_DEFAULTS.sustainGain,
    fadeDuration: overrides.fadeDuration ?? AUDIO_CHAIN_DEFAULTS.fadeDuration,
  };
}

