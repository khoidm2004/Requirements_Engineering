import type React from 'react';

export const EXERCISE_TYPES = ['E1', 'E2', 'E3', 'E4', 'E5'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const TYPE_ICONS: Record<ExerciseType, string> = { E1: '🔤', E2: '✂️', E3: '👂', E4: '🖼️', E5: '📖' };

export interface ChildSettings {
  rate: number;
  font: string;
  fontSize: number;
  lineSpacing: number;
  letterSpacing: 'normal' | 'wide';
  background: string;
  lineFocus: boolean;
  syllableColours: boolean;
}

export const DEFAULT_SETTINGS: ChildSettings = {
  rate: 1, font: 'Lexend', fontSize: 22, lineSpacing: 1.5, letterSpacing: 'normal', background: 'cream', lineFocus: false, syllableColours: false,
};

export const SETTING_OPTIONS = {
  rate: [0.6, 0.8, 1.0, 1.2],
  font: ['Lexend', 'OpenDyslexic', 'Atkinson Hyperlegible', 'Arial'],
  fontSize: [18, 22, 26, 32],
  lineSpacing: [1.5, 2.0, 2.5],
  letterSpacing: ['normal', 'wide'],
  background: ['cream', 'lightyellow', 'lightblue', 'lightgreen', 'white'],
} as const;

/** FR-SUP-04 backgrounds; text is always #222222. */
export const BACKGROUNDS: Record<string, string> = {
  cream: '#fbf5e6', lightyellow: '#fdf8c7', lightblue: '#dcecf8', lightgreen: '#e0f2dc', white: '#ffffff',
};

export const FONT_STACKS: Record<string, string> = {
  Lexend: "'Lexend', system-ui, sans-serif",
  OpenDyslexic: "'OpenDyslexic', 'Lexend', sans-serif",
  'Atkinson Hyperlegible': "'Atkinson Hyperlegible', system-ui, sans-serif",
  Arial: 'Arial, Helvetica, sans-serif',
};

/** CSS custom properties applying a child's reading settings (FR-SUP-03/04). */
export function readingStyle(s: ChildSettings): React.CSSProperties {
  return {
    '--read-font': FONT_STACKS[s.font] ?? FONT_STACKS.Lexend,
    '--read-size': `${s.fontSize}px`,
    '--read-line': String(s.lineSpacing),
    '--read-letter': s.letterSpacing === 'wide' ? '0.12em' : 'normal',
    '--read-bg': BACKGROUNDS[s.background] ?? BACKGROUNDS.cream,
  } as React.CSSProperties;
}
