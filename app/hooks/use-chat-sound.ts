import { useEffect } from "react";
import { create } from "zustand";

const MUTE_KEY = "chat_sound_muted";

let audio_ctx: AudioContext | null = null;
const get_ctx = () => (audio_ctx ??= new AudioContext());

const play_tone = (
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
};

// Two-note chime synthesized on the fly — no audio asset to ship/license.
// Fails silently if the browser blocks autoplay (no user gesture yet) or
// Web Audio isn't available; the sound is a nice-to-have, never load-bearing.
export const play_notification_ping = () => {
  try {
    const ctx = get_ctx();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    play_tone(ctx, 880, now, 0.14);
    play_tone(ctx, 1318.5, now + 0.09, 0.18);
  } catch {
    // ignored
  }
};

// Shared across every mounted consumer (chat widget, Settings) so toggling
// mute in one place is instantly reflected everywhere else — a plain
// useState per call site would give each component its own copy, silently
// falling out of sync while both stay mounted in the same session.
type ChatSoundStore = {
  muted: boolean;
  loaded: boolean;
  set_muted: (value: boolean) => void;
  load: () => void;
};

const use_chat_sound_store = create<ChatSoundStore>((set, get) => ({
  muted: false,
  loaded: false,
  set_muted: (value) => {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
    set({ muted: value });
  },
  load: () => {
    if (get().loaded) return;
    set({ muted: localStorage.getItem(MUTE_KEY) === "1", loaded: true });
  },
}));

export const use_chat_sound_muted = () => {
  const { muted, set_muted, load } = use_chat_sound_store();

  useEffect(() => {
    load();
  }, [load]);

  return { muted, set_muted };
};
