import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { speak, speakSequence, stop, type Lang } from '../lib/tts';
import { syllabify } from '../../../shared/syllables';
import { useI18n } from '../lib/i18n';
import { SpeakerIcon } from './Speak';

/**
 * A reading text with:
 *  - FR-SUP-01 read-aloud with word highlighting
 *  - FR-SUP-07 word help: click/tap (or Enter on) a word to hear its syllables and the whole word
 *  - FR-SUP-05 line focus: dims all lines except the current one (arrow keys, swipe, buttons)
 *  - FR-SUP-06 syllable colouring: syllables of each word in two alternating colours
 * Keyboard (NFR-ACS-02): the text is one tab stop; ←/→ select a word, Enter speaks it, ↑/↓ move line focus.
 */
export function ReadingText({
  text, lang, rate = 1, lineFocus = false, syllableColours = false, wordHelp = true, autoRead = false, className = '', as = 'p',
}: {
  text: string; lang: Lang; rate?: number; lineFocus?: boolean; syllableColours?: boolean; wordHelp?: boolean; autoRead?: boolean;
  className?: string; as?: 'p' | 'div';
}) {
  const { t } = useI18n();
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const [spoken, setSpoken] = useState(-1);
  const [cursor, setCursor] = useState(-1);
  const [lineOf, setLineOf] = useState<number[]>([]);
  const [line, setLine] = useState(0);
  const refs = useRef<Array<HTMLSpanElement | null>>([]);
  const box = useRef<HTMLDivElement>(null);
  const touchY = useRef<number | null>(null);

  // Work out which visual line each word is on (for line focus).
  const measure = useCallback(() => {
    if (!lineFocus) return;
    const tops: number[] = [];
    const out = refs.current.slice(0, words.length).map((el) => {
      const top = el ? Math.round(el.offsetTop) : 0;
      let i = tops.findIndex((tp) => Math.abs(tp - top) < 4);
      if (i < 0) i = tops.push(top) - 1;
      return i;
    });
    setLineOf(out);
  }, [lineFocus, words.length]);

  useLayoutEffect(measure, [measure, text]);
  useEffect(() => {
    if (!lineFocus || !box.current) return;
    const ro = new ResizeObserver(measure);
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [lineFocus, measure]);
  useEffect(() => () => stop(), []);

  const lineCount = lineOf.length ? Math.max(...lineOf) + 1 : 1;
  const moveLine = (d: number) => setLine((l) => Math.min(lineCount - 1, Math.max(0, l + d)));

  // While reading aloud, line focus follows the spoken word.
  useEffect(() => {
    if (lineFocus && spoken >= 0 && lineOf[spoken] !== undefined) setLine(lineOf[spoken]);
  }, [spoken, lineFocus, lineOf]);

  const readAll = useCallback(() => {
    speak(words.join(' '), { lang, rate, onWord: setSpoken });
  }, [words, lang, rate]);

  useEffect(() => {
    if (autoRead) readAll();
  }, [autoRead, readAll]);

  const helpWord = (i: number) => {
    if (!wordHelp) return;
    const w = words[i].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!w) return;
    setSpoken(i);
    const syl = syllabify(w.toLowerCase(), lang);
    speakSequence(syl.length > 1 ? [...syl, w] : [w], { lang, rate: Math.min(rate, 0.9) }).then(() => setSpoken(-1));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setCursor((c) => {
        const n = Math.min(words.length - 1, Math.max(0, c + (e.key === 'ArrowRight' ? 1 : -1)));
        if (lineFocus && lineOf[n] !== undefined) setLine(lineOf[n]);
        return n;
      });
    } else if ((e.key === 'Enter' || e.key === ' ') && cursor >= 0) {
      e.preventDefault();
      helpWord(cursor);
    } else if (lineFocus && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      moveLine(e.key === 'ArrowDown' ? 1 : -1);
    }
  };

  const Tag = as;
  return (
    <div className={`reading ${className}`}>
      <div className="reading__tools">
        <button type="button" className="speak-btn" onClick={readAll} aria-label={t('reading.readAloud')} title={t('reading.readAloud')}>
          <SpeakerIcon />
        </button>
        {lineFocus && lineCount > 1 && (
          <>
            <button type="button" className="icon-btn" onClick={() => moveLine(-1)} aria-label={t('reading.prevLine')} disabled={line === 0}>▲</button>
            <button type="button" className="icon-btn" onClick={() => moveLine(1)} aria-label={t('reading.nextLine')} disabled={line >= lineCount - 1}>▼</button>
          </>
        )}
      </div>
      <div
        ref={box}
        className="reading__text"
        tabIndex={0}
        role="group"
        aria-label={wordHelp ? t('reading.textHint') : undefined}
        onKeyDown={onKey}
        onFocus={() => cursor < 0 && setCursor(0)}
        onTouchStart={(e) => (touchY.current = e.touches[0].clientY)}
        onTouchEnd={(e) => {
          if (!lineFocus || touchY.current === null) return;
          const dy = e.changedTouches[0].clientY - touchY.current;
          if (Math.abs(dy) > 40) moveLine(dy < 0 ? 1 : -1);
          touchY.current = null;
        }}
      >
        <Tag className="reading__p">
          {words.map((w, i) => (
            <span key={i}>
              <span
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={[
                  'word',
                  i === spoken ? 'word--spoken' : '',
                  i === cursor ? 'word--cursor' : '',
                  lineFocus && lineOf.length && lineOf[i] !== line ? 'word--dim' : '',
                  wordHelp ? 'word--help' : '',
                ].join(' ')}
                onClick={() => {
                  setCursor(i);
                  helpWord(i);
                }}
              >
                {syllableColours ? <ColouredWord word={w} lang={lang} /> : w}
              </span>{' '}
            </span>
          ))}
        </Tag>
      </div>
    </div>
  );
}

/** FR-SUP-06 — splits a word (keeping surrounding punctuation) into syllables in two alternating colours. */
function ColouredWord({ word, lang }: { word: string; lang: Lang }) {
  const m = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u.exec(word);
  const [, pre, core, post] = m ?? ['', '', word, ''];
  const parts = core ? syllabify(core.toLowerCase(), lang) : [];
  if (parts.length < 2 || parts.join('').length !== core.length) return <>{word}</>;
  let at = 0;
  return (
    <>
      {pre}
      {parts.map((p, i) => {
        const piece = core.slice(at, (at += p.length));
        return <span key={i} className={i % 2 ? 'syl-b' : 'syl-a'}>{piece}</span>;
      })}
      {post}
    </>
  );
}
