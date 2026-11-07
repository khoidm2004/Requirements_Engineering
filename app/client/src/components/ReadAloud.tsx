import { useEffect, useMemo, useState } from 'react';
import { speak, stopSpeaking, ttsAvailable } from '../lib/tts';

/** Speaker button that reads a text aloud. */
export function SpeakButton({ text, rate = 1, label = 'Read aloud', big = false }: { text: string; rate?: number; label?: string; big?: boolean }) {
  if (!ttsAvailable()) return null;
  return (
    <button type="button" className={`speak-btn ${big ? 'speak-btn--big' : ''}`} onClick={() => speak(text, { rate })} aria-label={label} title={label}>
      <span aria-hidden="true">🔊</span>
      {big && <span className="speak-btn__label">{label}</span>}
    </button>
  );
}

/**
 * A text that can be read aloud with the spoken word highlighted (req 9).
 * Tapping a single word reads just that word.
 */
export function ReadAloud({
  text, rate = 1, autoRead = false, className = '', spokenText,
}: { text: string; rate?: number; autoRead?: boolean; className?: string; spokenText?: string }) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const [current, setCurrent] = useState(-1);
  const [playing, setPlaying] = useState(false);

  const readAll = () => {
    setPlaying(true);
    speak(spokenText ?? words.join(' '), { rate, onWord: setCurrent }).then(() => setPlaying(false));
  };
  const stop = () => {
    stopSpeaking();
    setCurrent(-1);
    setPlaying(false);
  };

  useEffect(() => {
    if (autoRead) readAll();
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className={`read-aloud ${className}`}>
      {ttsAvailable() && (
        <button type="button" className="speak-btn" onClick={playing ? stop : readAll} aria-label={playing ? 'Stop reading' : 'Read aloud'} title={playing ? 'Stop reading' : 'Read aloud'}>
          <span aria-hidden="true">{playing ? '⏹' : '🔊'}</span>
        </button>
      )}
      <p className="read-aloud__text">
        {words.map((w, i) => (
          <span key={i}>
            <span
              className={`word ${i === current ? 'word--on' : ''}`}
              onClick={() => {
                setCurrent(i);
                speak(w.replace(/[^\p{L}\p{N}'’-]/gu, '') || w, { rate }).then(() => setCurrent(-1));
              }}
            >
              {w}
            </span>{' '}
          </span>
        ))}
      </p>
    </div>
  );
}
