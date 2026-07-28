import { useEffect, useState } from "react";
import { use_is_dark } from "~/hooks/use-theme";
import palettes_data from "~/hooks/theme-palettes.json";

const PALETTE_KEY = "theme_palette";

export type PaletteKey = keyof typeof palettes_data;

type PaletteVariant = { page: string; card: string; ink: string; muted: string; line: string };
type Palette = { label: string; accent: string; light: PaletteVariant; dark: PaletteVariant };

// Palette definitions live in theme-palettes.json (not inline here) so new
// presets or color tweaks are a one-file JSON edit — also imported as-is by
// root.tsx's pre-hydration script, so the two stay in sync automatically.
export const PALETTES: Record<PaletteKey, Palette> = palettes_data;

export const apply_palette = (key: PaletteKey, is_dark: boolean) => {
  const palette = PALETTES[key] ?? PALETTES.onyx;
  const variant = is_dark ? palette.dark : palette.light;
  const root = document.documentElement.style;
  root.setProperty("--color-flag-red", `hsl(${palette.accent})`);
  root.setProperty("--color-primary", `hsl(${palette.accent})`);
  root.setProperty("--color-page", `hsl(${variant.page})`);
  root.setProperty("--color-card", `hsl(${variant.card})`);
  root.setProperty("--color-ink", `hsl(${variant.ink})`);
  root.setProperty("--color-muted", `hsl(${variant.muted})`);
  root.setProperty("--color-line", `hsl(${variant.line})`);
};

export const use_theme_palette = () => {
  const is_dark = use_is_dark();
  const [palette, set_palette_state] = useState<PaletteKey>("onyx");
  const [mounted, set_mounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(PALETTE_KEY) ?? "onyx") as PaletteKey;
    apply_palette(saved, is_dark);
    set_palette_state(saved);
    set_mounted(true);
  }, []);

  // The overrides above are inline styles on <html>, which beat the .dark
  // class rules in app.css — so toggling light/dark no longer repaints these
  // tokens on its own and this has to re-apply the palette's other variant.
  useEffect(() => {
    if (!mounted) return;
    apply_palette(palette, is_dark);
  }, [is_dark]);

  const set_palette = (key: PaletteKey) => {
    apply_palette(key, is_dark);
    localStorage.setItem(PALETTE_KEY, key);
    set_palette_state(key);
  };

  return { palette, set_palette, mounted };
};
