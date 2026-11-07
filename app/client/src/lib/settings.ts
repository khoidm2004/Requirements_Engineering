import type React from 'react';
import type { Settings } from './types';

export const FONTS: Array<{ name: string; stack: string; note?: string }> = [
  { name: 'OpenDyslexic', stack: "'OpenDyslexic', 'Lexend', sans-serif", note: 'made for dyslexia' },
  { name: 'Lexend', stack: "'Lexend', system-ui, sans-serif", note: 'easy to read' },
  { name: 'Atkinson Hyperlegible', stack: "'Atkinson Hyperlegible', system-ui, sans-serif", note: 'clear letter shapes' },
  { name: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { name: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { name: 'Comic Sans MS', stack: "'Comic Sans MS', 'Comic Neue', cursive" },
];

export const COLOUR_THEMES: Array<{ name: string; textColor: string; background: string; highlight: string }> = [
  { name: 'Cream', textColor: '#1f2933', background: '#fdf6e3', highlight: '#ffd54f' },
  { name: 'White', textColor: '#111111', background: '#ffffff', highlight: '#ffe066' },
  { name: 'Sky', textColor: '#102a43', background: '#dcecf8', highlight: '#ffd166' },
  { name: 'Mint', textColor: '#14342b', background: '#e0f2dc', highlight: '#ffd54f' },
  { name: 'Peach', textColor: '#3b1f12', background: '#fde4cf', highlight: '#b5e48c' },
  { name: 'Night', textColor: '#f5f1e6', background: '#1e2430', highlight: '#7c5cff' },
];

export const DEFAULT_SETTINGS: Settings = {
  font: 'OpenDyslexic',
  fontSize: 22,
  letterSpacing: 0.05,
  lineHeight: 1.8,
  textColor: '#1f2933',
  background: '#fdf6e3',
  highlight: '#ffd54f',
  speechRate: 0.9,
};

/** Returns black or white, whichever reads better on the given colour. */
export function contrastOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#111111' : '#ffffff';
}

/** CSS custom properties that apply a kid's settings to the whole kid area (req 10). */
export function settingsStyle(s: Settings): React.CSSProperties {
  const dark = contrastOn(s.background) === '#ffffff';
  return {
    '--kid-font': `'RB Emoji', ${FONTS.find((f) => f.name === s.font)?.stack ?? FONTS[0].stack}`,
    '--kid-size': `${s.fontSize}px`,
    '--kid-letter': `${s.letterSpacing}em`,
    '--kid-line': String(s.lineHeight),
    '--kid-text': s.textColor,
    '--kid-bg': s.background,
    '--kid-highlight': s.highlight,
    '--kid-on-highlight': contrastOn(s.highlight),
    '--kid-card': dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)',
    '--kid-border': dark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)',
  } as React.CSSProperties;
}
