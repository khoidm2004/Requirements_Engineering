import { speak, stop, type Lang } from '../lib/tts';
import { useI18n } from '../lib/i18n';

export function SpeakerIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Speaker button reading `text` aloud (FR-SUP-01, FR-EX-02). 48 × 48 px minimum (NFR-US-03). */
export function SpeakButton({
  text, lang, rate = 1, label, onWord, className = '', big = false,
}: {
  text: string; lang: Lang; rate?: number; label?: string; onWord?: (i: number) => void; className?: string; big?: boolean;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className={`speak-btn ${big ? 'speak-btn--big' : ''} ${className}`}
      aria-label={label ?? t('common.listen')}
      title={label ?? t('common.listen')}
      onClick={(e) => {
        e.stopPropagation();
        stop();
        speak(text, { lang, rate, onWord });
      }}
    >
      <SpeakerIcon size={big ? 40 : 26} />
    </button>
  );
}
