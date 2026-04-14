import { useRef, useState, useCallback, useEffect } from 'react';
import type { AudioSettings } from '../types';
import { AUDIO_CHAIN_DEFAULTS } from '../config/audio';

interface UseAudioOptions {
  src: string;
  settings?: Partial<AudioSettings>;
  autoplay?: boolean;
}

export function useAudio({ src, settings = {}, autoplay = true }: UseAudioOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const hasFadeRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  const resolvedSettings: AudioSettings = {
    loop: settings.loop ?? AUDIO_CHAIN_DEFAULTS.loop,
    elementVolume: settings.elementVolume ?? AUDIO_CHAIN_DEFAULTS.elementVolume,
    initialGain: settings.initialGain ?? AUDIO_CHAIN_DEFAULTS.initialGain,
    fadeTargetGain: settings.fadeTargetGain ?? AUDIO_CHAIN_DEFAULTS.fadeTargetGain,
    sustainGain: settings.sustainGain ?? AUDIO_CHAIN_DEFAULTS.sustainGain,
    fadeDuration: settings.fadeDuration ?? AUDIO_CHAIN_DEFAULTS.fadeDuration,
  };

  const setupAudioChain = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    const ctx = audioContextRef.current;

    if (!sourceRef.current) {
      try {
        sourceRef.current = ctx.createMediaElementSource(audio);
      } catch {
        return;
      }
    }

    if (gainRef.current) {
      try {
        gainRef.current.disconnect();
      } catch {
        // ignore
      }
    }

    gainRef.current = ctx.createGain();
    hasFadeRef.current = false;
    gainRef.current.gain.setValueAtTime(resolvedSettings.initialGain, ctx.currentTime);

    try {
      sourceRef.current.disconnect();
    } catch {
      // ignore
    }

    sourceRef.current.connect(gainRef.current);
    gainRef.current.connect(ctx.destination);
  }, [resolvedSettings.initialGain]);

  const applyFade = useCallback(() => {
    const ctx = audioContextRef.current;
    const gain = gainRef.current;

    if (!ctx || !gain || hasFadeRef.current) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(resolvedSettings.initialGain, now);
    gain.gain.linearRampToValueAtTime(
      resolvedSettings.fadeTargetGain,
      now + resolvedSettings.fadeDuration
    );
    gain.gain.setValueAtTime(
      resolvedSettings.sustainGain,
      now + resolvedSettings.fadeDuration + 0.001
    );
    hasFadeRef.current = true;
  }, [resolvedSettings]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const ctx = audioContextRef.current;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    setUserPaused(false);
    audio.play().then(() => {
      applyFade();
    }).catch(() => {});
  }, [applyFade]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setUserPaused(true);
    audio.pause();
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const allowAutoplay = useCallback(() => {
    setUserPaused(false);
  }, []);

  // Initialize audio element
  useEffect(() => {
    setIsReady(false);
    const audio = new Audio();
    audio.loop = resolvedSettings.loop;
    audio.volume = resolvedSettings.elementVolume;
    audio.preload = 'auto';
    audio.src = src;
    audioRef.current = audio;

    const handleCanPlay = () => setIsReady(true);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => setIsReady(false);

    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    setupAudioChain();

    return () => {
      audio.pause();
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audioRef.current = null;
    };
  }, [src, resolvedSettings.loop, resolvedSettings.elementVolume, setupAudioChain]);

  // Handle autoplay
  useEffect(() => {
    if (!autoplay || !isReady || userPaused) return;

    const attemptPlay = () => {
      play();
      document.removeEventListener('pointerdown', attemptPlay);
      document.removeEventListener('keydown', attemptPlay);
    };

    // Try immediate autoplay
    const audio = audioRef.current;
    if (audio) {
      audio.play().then(() => {
        applyFade();
      }).catch(() => {
        // Autoplay blocked, wait for user interaction
        document.addEventListener('pointerdown', attemptPlay, { once: true });
        document.addEventListener('keydown', attemptPlay, { once: true });
      });
    }

    return () => {
      document.removeEventListener('pointerdown', attemptPlay);
      document.removeEventListener('keydown', attemptPlay);
    };
  }, [autoplay, isReady, userPaused, play, applyFade]);

  return {
    isPlaying,
    isReady,
    play,
    pause,
    toggle,
    allowAutoplay,
  };
}

