import { useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { EXERCISE_TYPES, SETTING_OPTIONS, TYPE_ICONS, readingStyle, type ChildSettings, type ExerciseType } from '../lib/constants';
import { BarMini, LineMini } from './Charts';

export interface Dashboard {
  student: { id: number; name: string; studentNumber: string; birthYear: number; language: 'en' | 'fi'; stars: number; classId: number; locked: boolean };
  levels: Record<ExerciseType, number>;
  settings: ChildSettings;
  weeks: Array<{ weekStart: string; minutes: number; exercises: number; accuracy: Record<ExerciseType, number | null> }>;
}

const pct = (v: number) => `${Math.round(v * 100)} %`;

/** FR-PRG-02 — per-child progress: weekly time and count, current levels, 12-week accuracy trend. */
export function StudentDashboard({ d }: { d: Dashboard }) {
  const { t } = useI18n();
  const [table, setTable] = useState(false);
  const thisWeek = d.weeks[d.weeks.length - 1];
  return (
    <section aria-labelledby="dash-h">
      <div className="row row--between">
        <h2 id="dash-h">{t('dash.title')}</h2>
        <button className="btn btn--ghost" onClick={() => setTable((v) => !v)} aria-pressed={table}>
          {table ? t('dash.showCharts') : t('dash.showTable')}
        </button>
      </div>

      <div className="stat-row">
        <div className="stat"><span className="stat__v">{thisWeek.minutes}</span><span className="stat__l">{t('dash.minutesThisWeek')}</span></div>
        <div className="stat"><span className="stat__v">{thisWeek.exercises}</span><span className="stat__l">{t('dash.exercisesThisWeek')}</span></div>
        <div className="stat"><span className="stat__v">⭐ {d.student.stars}</span><span className="stat__l">{t('dash.stars')}</span></div>
      </div>

      <h3>{t('dash.levels')}</h3>
      <ul className="level-list">
        {EXERCISE_TYPES.map((ty) => (
          <li key={ty}>
            <span aria-hidden="true">{TYPE_ICONS[ty]}</span> {t('type.' + ty)}: <strong>{t('dash.level', { n: d.levels[ty] })}</strong>
          </li>
        ))}
      </ul>

      {table ? (
        <div className="table-wrap">
          <table className="table">
            <caption>{t('dash.tableCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('dash.week')}</th>
                <th scope="col">{t('dash.minutes')}</th>
                <th scope="col">{t('dash.exercises')}</th>
                {EXERCISE_TYPES.map((ty) => <th scope="col" key={ty}>{t('type.' + ty)}</th>)}
              </tr>
            </thead>
            <tbody>
              {d.weeks.map((w) => (
                <tr key={w.weekStart}>
                  <th scope="row">{w.weekStart}</th>
                  <td>{w.minutes}</td>
                  <td>{w.exercises}</td>
                  {EXERCISE_TYPES.map((ty) => <td key={ty}>{w.accuracy[ty] === null ? '–' : pct(w.accuracy[ty]!)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <h3>{t('dash.practicePerWeek')}</h3>
          <div className="chart-grid">
            <BarMini title={t('dash.minutes')} points={d.weeks.map((w) => ({ label: w.weekStart, value: w.minutes }))} format={(v) => t('dash.minutesN', { n: v })} />
            <BarMini title={t('dash.exercises')} points={d.weeks.map((w) => ({ label: w.weekStart, value: w.exercises }))} format={(v) => String(v)} />
          </div>
          <h3>{t('dash.accuracyTrend')}</h3>
          <div className="chart-grid">
            {EXERCISE_TYPES.map((ty) => (
              <LineMini key={ty} title={t('type.' + ty)} points={d.weeks.map((w) => ({ label: w.weekStart, value: w.accuracy[ty] }))} format={pct} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** FR-EX-07 — the teacher can override the level per exercise type. */
export function LevelsEditor({ studentId, initial, onSaved }: { studentId: number; initial: Record<ExerciseType, number>; onSaved?: () => void }) {
  const { t } = useI18n();
  const [levels, setLevels] = useState<Record<string, number>>(initial);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="card form"
      onSubmit={async (e) => {
        e.preventDefault();
        await api('PUT', `/teacher/students/${studentId}/levels`, levels);
        setSaved(true);
        onSaved?.();
      }}
    >
      <h3>{t('levels.title')}</h3>
      <p className="hint">{t('levels.hint')}</p>
      <div className="grid-2">
        {EXERCISE_TYPES.map((ty) => (
          <label key={ty} className="field">
            <span>{ty} – {t('type.' + ty)}</span>
            <select value={levels[ty]} onChange={(e) => { setSaved(false); setLevels({ ...levels, [ty]: Number(e.target.value) }); }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ))}
      </div>
      <button className="btn btn--primary" type="submit">{t('common.save')}</button>
      {saved && <span role="status" className="ok"> ✓ {t('common.saved')}</span>}
    </form>
  );
}

/** FR-SUP-02..06 — reading settings editor (used by the child and by the teacher). */
export function SettingsEditor({
  value, onChange, big = false,
}: { value: ChildSettings; onChange: (patch: Partial<ChildSettings>) => void; big?: boolean }) {
  const { t } = useI18n();
  const opt = <K extends keyof typeof SETTING_OPTIONS>(key: K, render: (v: (typeof SETTING_OPTIONS)[K][number]) => React.ReactNode) => (
    <fieldset className="field setting">
      <legend>{t('settings.' + key)}</legend>
      <div className={`choice-row ${big ? 'choice-row--big' : ''}`}>
        {(SETTING_OPTIONS[key] as readonly (string | number)[]).map((v) => (
          <button
            type="button"
            key={String(v)}
            className={`choice ${value[key] === v ? 'choice--on' : ''}`}
            aria-pressed={value[key] === v}
            onClick={() => onChange({ [key]: v } as Partial<ChildSettings>)}
          >
            {render(v as never)}
          </button>
        ))}
      </div>
    </fieldset>
  );
  return (
    <div className="settings">
      {opt('font', (f) => <span style={readingStyle({ ...value, font: f, fontSize: 20 })} className="sample">Aa · {f}</span>)}
      {opt('fontSize', (s) => <span style={{ fontSize: Math.min(Number(s), 28) }}>{s}</span>)}
      {opt('lineSpacing', (l) => <span>{String(l).replace('.', ',')}</span>)}
      {opt('letterSpacing', (l) => <span style={{ letterSpacing: l === 'wide' ? '0.12em' : 'normal' }}>{t('settings.letter.' + l)}</span>)}
      {opt('background', (b) => (
        <span className="swatch" style={readingStyle({ ...value, background: b as string })}>
          <span className="sr-only">{t('settings.bg.' + b)}</span>
          <span aria-hidden="true">Aa</span>
        </span>
      ))}
      {opt('rate', (r) => <span>{String(r).replace('.', ',')}×</span>)}
      {(['lineFocus', 'syllableColours'] as const).map((key) => (
        <fieldset className="field setting" key={key}>
          <legend>{t('settings.' + key)}</legend>
          <div className={`choice-row ${big ? 'choice-row--big' : ''}`}>
            {[false, true].map((v) => (
              <button type="button" key={String(v)} className={`choice ${value[key] === v ? 'choice--on' : ''}`} aria-pressed={value[key] === v} onClick={() => onChange({ [key]: v })}>
                {v ? t('common.on') : t('common.off')}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="reading-preview" style={readingStyle(value)}>
        <p>{t('settings.preview')}</p>
      </div>
    </div>
  );
}
