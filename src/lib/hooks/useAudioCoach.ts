import { useRef, useState, useCallback, useEffect } from 'react';

interface AudioCoachState {
  enabled: boolean;
  muted: boolean;
  speaking: boolean;
}

interface AudioCoachActions {
  enable: () => void;
  disable: () => void;
  toggleMute: () => void;
  speak: (text: string, opts?: { interrupt?: boolean }) => void;
  stop: () => void;
}

const PREF_KEY = 'startfit_audio_coach_enabled';
const MUTE_KEY = 'startfit_audio_coach_muted';

function loadPref(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function useAudioCoach(): AudioCoachState & AudioCoachActions {
  const [enabled, setEnabled] = useState(() => loadPref(PREF_KEY));
  const [muted, setMuted] = useState(() => loadPref(MUTE_KEY));
  const [speaking, setSpeaking] = useState(false);
  const lastSpokenRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, String(enabled));
    } catch { /* ignore */ }
  }, [enabled]);

  useEffect(() => {
    try {
      localStorage.setItem(MUTE_KEY, String(muted));
    } catch { /* ignore */ }
  }, [muted]);

  const speak = useCallback((text: string, opts?: { interrupt?: boolean }) => {
    if (!enabled || muted || !supported || !text.trim()) return;

    const now = Date.now();
    if (text === lastSpokenRef.current && now - lastTimeRef.current < 5000) return;
    lastSpokenRef.current = text;
    lastTimeRef.current = now;

    if (opts?.interrupt) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [enabled, muted, supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const enable = useCallback(() => setEnabled(true), []);
  const disable = useCallback(() => {
    setEnabled(false);
    stop();
  }, [stop]);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  return { enabled, muted, speaking, enable, disable, toggleMute, speak, stop };
}
