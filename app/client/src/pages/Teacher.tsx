import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdultLayout, ErrorText, Loading } from '../components/Layout';
import { LevelsEditor, SettingsEditor, StudentDashboard, type Dashboard } from '../components/ChildPanels';
import { ReadingText } from '../components/ReadingText';
import { api, ApiError, get, post } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import { EXERCISE_TYPES, type ChildSettings, type ExerciseType } from '../lib/constants';

const code = (e: unknown) => (e instanceof ApiError ? e.code : 'network');
const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

interface Cls {
  id: number;
  name: string;
  code: string;
  students: number;
}

/** FR-ACC-02 — prompt shown wherever an unverified teacher tries to set up classes. */
function VerifyFirst() {
  const { t } = useI18n();
  const [sent, setSent] = useState(false);
  return (
    <div className="notice" role="status">
      <p>{t('teacher.verifyFirst')}</p>
      {sent ? (
        <p className="ok">✓ {t('teacher.resent')}</p>
      ) : (
        <button className="btn" onClick={async () => { await post('/auth/resend-verification'); setSent(true); }}>{t('teacher.resend')}</button>
      )}
    </div>
  );
}

function useVerified() {
  const { me } = useSession();
  return me?.kind === 'teacher' && me.teacher.email_verified;
}

export function TeacherHome() {
  const { t } = useI18n();
  const verified = useVerified();
  const [classes, setClasses] = useState<Cls[] | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => get<Cls[]>('/teacher/classes').then(setClasses).catch(() => setClasses([])), []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdultLayout title={t('teacher.title')}>
      {!verified && <VerifyFirst />}
      {classes === null ? (
        <Loading />
      ) : classes.length === 0 ? (
        <p>{t('teacher.noClasses')}</p>
      ) : (
        <div className="kid-grid">
          {classes.map((c) => (
            <Link className="card class-card" key={c.id} to={`/teacher/class/${c.id}`}>
              <h2>{c.name}</h2>
              <p className="muted">{t('teacher.studentsCount', { n: c.students })}</p>
              <p>{t('teacher.code')}: <code className="class-code">{c.code}</code></p>
            </Link>
          ))}
        </div>
      )}
      <form
        className="card form form--inline"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            await post('/teacher/classes', { name });
            setName('');
            load();
          } catch (e) {
            setErr(code(e));
          }
        }}
      >
        <label className="field">
          <span>{t('teacher.newClass')}</span>
          <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="3B" />
        </label>
        <button className="btn btn--primary" type="submit">{t('teacher.create')}</button>
        <ErrorText code={err} />
      </form>
    </AdultLayout>
  );
}

interface Row {
  id: number;
  name: string;
  studentNumber: string;
  minutes7: number;
  exercises7: number;
  levels: Record<ExerciseType, number>;
  inactive: boolean;
  locked: boolean;
}
type SortKey = 'name' | 'studentNumber' | 'minutes7' | 'exercises7' | 'inactive' | 'locked' | ExerciseType;

/** FR-PRG-03 — class overview (sortable by every column), FR-ACC-04 enrolment, FR-ACC-09 unlock, FR-PRG-04 / DR-06 export. */
export function ClassPage() {
  const { t } = useI18n();
  const id = Number(useParams().id);
  const [data, setData] = useState<{ class: Cls; students: Row[] } | null>(null);
  const [missing, setMissing] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const load = useCallback(
    () => get<{ class: Cls; students: Row[] }>(`/teacher/classes/${id}/overview`).then(setData).catch(() => setMissing(true)),
    [id],
  );
  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const val = (r: Row): string | number | boolean =>
      (EXERCISE_TYPES as readonly string[]).includes(sort.key) ? r.levels[sort.key as ExerciseType] : (r[sort.key as keyof Row] as string | number | boolean);
    return [...data.students].sort((a, b) => {
      const va = val(a), vb = val(b);
      const c = typeof va === 'string' ? va.localeCompare(vb as string, undefined, { numeric: true, sensitivity: 'base' }) : Number(va) - Number(vb);
      return c * sort.dir;
    });
  }, [data, sort]);

  if (missing) return <AdultLayout><p>{t('error.class_not_found')}</p><Link to="/teacher">← {t('common.back')}</Link></AdultLayout>;
  if (!data) return <AdultLayout><Loading /></AdultLayout>;

  const th = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="th-btn" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : 1 }))}>
        {label} <span aria-hidden="true">{sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );

  return (
    <AdultLayout>
      <p><Link to="/teacher">← {t('nav.classes')}</Link></p>
      <div className="row row--between">
        <h1>{data.class.name}</h1>
        <span>{t('teacher.code')}: <code className="class-code">{data.class.code}</code></span>
      </div>

      <h2>{t('teacher.overview')}</h2>
      {data.students.length === 0 ? (
        <p>{t('teacher.noStudents')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption>{t('teacher.overviewCaption')}</caption>
            <thead>
              <tr>
                {th('name', t('teacher.col.name'))}
                {th('studentNumber', t('teacher.col.number'))}
                {th('minutes7', t('teacher.col.minutes7'))}
                {th('exercises7', t('teacher.col.exercises7'))}
                {EXERCISE_TYPES.map((ty) => <Fragment key={ty}>{th(ty, ty)}</Fragment>)}
                {th('inactive', t('teacher.col.inactive'))}
                {th('locked', t('teacher.col.locked'))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row"><Link to={`/teacher/student/${r.id}`}>{r.name}</Link></th>
                  <td className="student-number">{r.studentNumber}</td>
                  <td>{r.minutes7}</td>
                  <td>{r.exercises7}</td>
                  {EXERCISE_TYPES.map((ty) => <td key={ty}>{r.levels[ty]}</td>)}
                  <td>{r.inactive ? <span className="badge badge--warn">⚠ {t('teacher.inactive')}</span> : <span className="muted">–</span>}</td>
                  <td>
                    {r.locked ? (
                      <span className="row">
                        <span className="badge badge--lock">🔒 {t('teacher.locked')}</span>
                        <button className="btn btn--ghost" onClick={async () => { await post(`/teacher/students/${r.id}/unlock`); load(); }}>
                          {t('teacher.unlock')}<span className="sr-only"> {r.name}</span>
                        </button>
                      </span>
                    ) : (
                      <span className="muted">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">{EXERCISE_TYPES.map((ty) => `${ty} = ${t('type.' + ty)}`).join(' · ')}</p>
        </div>
      )}
      <div className="actions-row">
        <a className="btn" href={`/api/teacher/classes/${id}/overview.csv`} download>⬇ {t('teacher.exportCsv')}</a>
        <a className="btn" href={`/api/teacher/classes/${id}/export.json`} download>⬇ {t('teacher.exportJson')}</a>
      </div>

      <EnrolForm classId={id} onDone={load} />
      <Assignments classId={id} students={data.students} />
    </AdultLayout>
  );
}

/** FR-ACC-04 — enrol a student: name, student number, language, birth year. */
function EnrolForm({ classId, onDone }: { classId: number; onDone: () => void }) {
  const { t, lang } = useI18n();
  const verified = useVerified();
  const year = new Date().getFullYear();
  const empty = { name: '', studentNumber: '', language: lang, birthYear: String(year - 8) };
  const [f, setF] = useState(empty);
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setAdded(null);
    try {
      await post(`/teacher/classes/${classId}/students`, { ...f, birthYear: Number(f.birthYear) });
      setAdded(f.name);
      setF({ ...empty, language: f.language });
      onDone();
    } catch (e) {
      setErr(code(e));
    }
  };
  return (
    <section className="card" aria-labelledby="enrol-h">
      <h2 id="enrol-h">{t('enrol.title')}</h2>
      {!verified ? (
        <VerifyFirst />
      ) : (
        <form className="form" onSubmit={submit}>
          <div className="grid-2">
            <label className="field">
              <span>{t('enrol.name')}</span>
              <input required maxLength={60} autoComplete="off" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </label>
            <div className="field">
              <label htmlFor="enrol-sn"><strong>{t('enrol.number')}</strong></label>
              <input id="enrol-sn" required maxLength={20} pattern="[A-Za-z0-9][A-Za-z0-9\-]*" autoComplete="off" value={f.studentNumber} onChange={(e) => setF({ ...f, studentNumber: e.target.value })} aria-describedby="sn-hint" />
              <small id="sn-hint" className="hint">{t('enrol.numberHint')}</small>
            </div>
            <label className="field">
              <span>{t('enrol.language')}</span>
              <select value={f.language} onChange={(e) => setF({ ...f, language: e.target.value as 'en' | 'fi' })}>
                <option value="fi">{t('lang.fi')}</option>
                <option value="en">{t('lang.en')}</option>
              </select>
            </label>
            <label className="field">
              <span>{t('enrol.birthYear')}</span>
              <select value={f.birthYear} onChange={(e) => setF({ ...f, birthYear: e.target.value })}>
                {Array.from({ length: 9 }, (_, i) => year - 5 - i).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
          <p className="hint">{t('enrol.hint')}</p>
          <ErrorText code={err} />
          {added && <p role="status" className="ok">✓ {t('enrol.added', { name: added })}</p>}
          <button className="btn btn--primary" type="submit">{t('enrol.submit')}</button>
        </form>
      )}
    </section>
  );
}

interface Assignment {
  id: number;
  type: string | null;
  level: number | null;
  exerciseId: number | null;
  exerciseTitle: string | null;
  dueDate: string | null;
  targets: number;
  done: number;
}
interface OwnContent {
  id: number;
  title: string;
  level: number;
  language: 'en' | 'fi';
  active: number;
}

/** FR-CNT-01 — assign a type + level, one of the teacher's texts, or an E4 item to the class or selected children. */
function Assignments({ classId, students }: { classId: number; students: Row[] }) {
  const { t } = useI18n();
  const [list, setList] = useState<Assignment[]>([]);
  const [texts, setTexts] = useState<OwnContent[]>([]);
  const [pictures, setPictures] = useState<OwnContent[]>([]);
  const [kind, setKind] = useState<'type' | 'text' | 'e4'>('type');
  const [type, setType] = useState<ExerciseType>('E1');
  const [level, setLevel] = useState<string>('');
  const [contentId, setContentId] = useState<string>('');
  const [who, setWho] = useState<'all' | 'some'>('all');
  const [selected, setSelected] = useState<number[]>([]);
  const [due, setDue] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => get<Assignment[]>(`/teacher/classes/${classId}/assignments`).then(setList), [classId]);
  useEffect(() => {
    load();
    get<OwnContent[]>('/teacher/texts').then((x) => setTexts(x.filter((c) => c.active))).catch(() => {});
    get<OwnContent[]>('/teacher/e4').then((x) => setPictures(x.filter((c) => c.active))).catch(() => {});
  }, [load]);

  const own = kind === 'text' ? texts : pictures;
  const option = (c: OwnContent) => `${c.title} · ${t('lang.' + c.language)} · ${t('dash.level', { n: c.level })}`;

  return (
    <section className="card" aria-labelledby="asg-h">
      <h2 id="asg-h">{t('assign.title')}</h2>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          try {
            const item = kind === 'type' ? { type, level: level ? Number(level) : null } : { exerciseId: Number(contentId) };
            await post(`/teacher/classes/${classId}/assignments`, { items: [item], studentIds: who === 'some' ? selected : [], dueDate: due || null });
            load();
          } catch (e) {
            setErr(code(e));
          }
        }}
      >
        <fieldset className="field">
          <legend>{t('assign.what')}</legend>
          <div className="segmented">
            {(['type', 'text', 'e4'] as const).map((k) => (
              <label key={k} className={`segmented__opt ${kind === k ? 'on' : ''}`}>
                <input type="radio" name="asg-kind" checked={kind === k} onChange={() => { setKind(k); setContentId(''); }} />
                {t('assign.by.' + k)}
              </label>
            ))}
          </div>
        </fieldset>
        {kind === 'type' ? (
          <div className="grid-2">
            <label className="field">
              <span>{t('assign.type')}</span>
              <select value={type} onChange={(e) => setType(e.target.value as ExerciseType)}>
                {EXERCISE_TYPES.map((ty) => <option key={ty} value={ty}>{ty} – {t('type.' + ty)}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{t('assign.level')}</span>
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="">{t('assign.childLevel')}</option>
                {LEVELS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        ) : (
          <label className="field">
            <span>{t(kind === 'text' ? 'assign.text' : 'assign.e4')}</span>
            <select required value={contentId} onChange={(e) => setContentId(e.target.value)}>
              <option value="">–</option>
              {own.map((x) => <option key={x.id} value={x.id}>{option(x)}</option>)}
            </select>
            {own.length === 0 && (
              <small className="hint">
                {t(kind === 'text' ? 'assign.noTexts' : 'assign.noE4')}{' '}
                <Link to={kind === 'text' ? '/teacher/texts' : '/teacher/pictures'}>{t(kind === 'text' ? 'nav.texts' : 'nav.pictures')}</Link>
              </small>
            )}
          </label>
        )}
        <fieldset className="field">
          <legend>{t('assign.who')}</legend>
          <div className="segmented">
            <label className={`segmented__opt ${who === 'all' ? 'on' : ''}`}><input type="radio" name="asg-who" checked={who === 'all'} onChange={() => setWho('all')} />{t('assign.wholeClass')}</label>
            <label className={`segmented__opt ${who === 'some' ? 'on' : ''}`}><input type="radio" name="asg-who" checked={who === 'some'} onChange={() => setWho('some')} />{t('assign.selected')}</label>
          </div>
          {who === 'some' && (
            <div className="check-grid">
              {students.map((k) => (
                <label key={k.id} className="check">
                  <input type="checkbox" checked={selected.includes(k.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, k.id] : selected.filter((x) => x !== k.id))} />
                  {k.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <label className="field">
          <span>{t('assign.due')}</span>
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <ErrorText code={err} />
        <button className="btn btn--primary" type="submit" disabled={students.length === 0}>{t('assign.submit')}</button>
      </form>

      {list.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('assign.exercise')}</th>
                <th scope="col">{t('assign.dueShort')}</th>
                <th scope="col">{t('assign.progress')}</th>
                <th scope="col"><span className="sr-only">{t('common.actions')}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td>{a.exerciseTitle ? `${a.type} – ${a.exerciseTitle}` : `${a.type} – ${t('type.' + a.type)}${a.level ? ` (${t('dash.level', { n: a.level })})` : ''}`}</td>
                  <td>{a.dueDate ?? '–'}</td>
                  <td>{a.done} / {a.targets}</td>
                  <td>
                    <button className="btn btn--ghost" onClick={async () => { await api('DELETE', `/teacher/assignments/${a.id}`); load(); }}>
                      {t('common.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** FR-PRG-02 child detail, FR-ACC-09 unlock, FR-EX-07 levels, FR-SUP settings, FR-ACC-08 removal. */
export function StudentPage() {
  const { t } = useI18n();
  const id = Number(useParams().id);
  const nav = useNavigate();
  const [d, setD] = useState<Dashboard | null>(null);
  const [missing, setMissing] = useState(false);
  const load = useCallback(() => get<Dashboard>(`/teacher/students/${id}`).then(setD).catch(() => setMissing(true)), [id]);
  useEffect(() => {
    load();
  }, [load]);
  if (missing) return <AdultLayout><p>{t('error.student_not_found')}</p><Link to="/teacher">← {t('common.back')}</Link></AdultLayout>;
  if (!d) return <AdultLayout><Loading /></AdultLayout>;
  const s = d.student;
  const updateSettings = async (patch: Partial<ChildSettings>) => {
    setD({ ...d, settings: { ...d.settings, ...patch } });
    await api('PATCH', `/teacher/students/${id}/settings`, patch).catch(() => load());
  };
  return (
    <AdultLayout>
      <p><Link to={`/teacher/class/${s.classId}`}>← {t('common.backToClass')}</Link></p>
      <h1>{s.name}</h1>
      <p className="muted">
        {t('student.meta', { number: s.studentNumber, year: s.birthYear, lang: t('lang.' + s.language) })}
      </p>
      {s.locked && (
        <div className="notice row row--between" role="status">
          <span>🔒 {t('student.locked')}</span>
          <button className="btn btn--primary" onClick={async () => { await post(`/teacher/students/${id}/unlock`); load(); }}>{t('teacher.unlock')}</button>
        </div>
      )}
      <StudentDashboard d={d} />
      <LevelsEditor key={JSON.stringify(d.levels)} studentId={id} initial={d.levels} onSaved={load} />
      <section className="card">
        <h3>{t('settings.title')}</h3>
        <p className="hint">{t('settings.teacherHint')}</p>
        <SettingsEditor value={d.settings} onChange={updateSettings} />
      </section>
      <section className="card">
        <h3>{t('student.remove')}</h3>
        <p>{t('student.removeWarning', { name: s.name })}</p>
        <button
          className="btn btn--danger"
          onClick={async () => {
            if (!window.confirm(t('student.removeConfirm', { name: s.name }))) return;
            await api('DELETE', `/teacher/students/${id}`);
            nav(`/teacher/class/${s.classId}`);
          }}
        >
          {t('student.remove')}
        </button>
      </section>
    </AdultLayout>
  );
}

/** Shared list controls for teacher texts and E4 items: show/hide and delete. */
function ContentActions({ item, onChange }: { item: OwnContent; onChange: () => void }) {
  const { t } = useI18n();
  return (
    <div className="row">
      <button className="btn btn--ghost" onClick={async () => { await api('PATCH', `/teacher/content/${item.id}`, { active: !item.active }); onChange(); }}>
        {item.active ? t('content.hide') : t('content.show')}
      </button>
      <button
        className="btn btn--ghost"
        onClick={async () => {
          if (!window.confirm(t('content.deleteConfirm', { title: item.title }))) return;
          await api('DELETE', `/teacher/content/${item.id}`);
          onChange();
        }}
      >
        {t('content.delete')}
      </button>
    </div>
  );
}

function LevelLanguage({ level, language, onLevel, onLanguage }: { level: number; language: 'en' | 'fi'; onLevel: (n: number) => void; onLanguage: (l: 'en' | 'fi') => void }) {
  const { t } = useI18n();
  return (
    <div className="grid-2">
      <label className="field">
        <span>{t('content.language')}</span>
        <select required value={language} onChange={(e) => onLanguage(e.target.value as 'en' | 'fi')}>
          <option value="fi">{t('lang.fi')}</option>
          <option value="en">{t('lang.en')}</option>
        </select>
      </label>
      <label className="field">
        <span>{t('content.level')}</span>
        <select required value={level} onChange={(e) => onLevel(Number(e.target.value))}>
          {LEVELS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </div>
  );
}

type Text = OwnContent & { content: { passage: string } };

/** FR-CNT-02 — teacher's own reading passages (E5) for their classes. */
export function TeacherTexts() {
  const { t, lang: uiLang } = useI18n();
  const verified = useVerified();
  const [texts, setTexts] = useState<Text[]>([]);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<'en' | 'fi'>(uiLang);
  const [level, setLevel] = useState(3);
  const [passage, setPassage] = useState('');
  const blank = () => [0, 1, 2].map(() => ({ q: '', options: ['', '', ''], answer: 0 }));
  const [questions, setQuestions] = useState(blank);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<number | null>(null);
  const load = useCallback(() => get<Text[]>('/teacher/texts').then(setTexts), []);
  useEffect(() => {
    load();
  }, [load]);
  const words = passage.trim() ? passage.trim().split(/\s+/).length : 0;
  const setQ = (qi: number, patch: Partial<(typeof questions)[number]>) => setQuestions(questions.map((x, i) => (i === qi ? { ...x, ...patch } : x)));

  return (
    <AdultLayout title={t('nav.texts')}>
      <p className="hint">{t('texts.intro')}</p>
      {texts.length > 0 && (
        <ul className="plain-list">
          {texts.map((x) => (
            <li key={x.id} className="card">
              <div className="row row--between">
                <div>
                  <strong>{x.title}</strong> <span className="muted">· {t('lang.' + x.language)} · {t('dash.level', { n: x.level })}</span>
                  {!x.active && <span className="badge">{t('content.hidden')}</span>}
                </div>
                <div className="row">
                  <button className="btn btn--ghost" onClick={() => setPreview(preview === x.id ? null : x.id)} aria-expanded={preview === x.id}>{t('content.preview')}</button>
                  <ContentActions item={x} onChange={load} />
                </div>
              </div>
              {preview === x.id && <ReadingText text={x.content.passage} lang={x.language} />}
            </li>
          ))}
        </ul>
      )}
      {!verified ? (
        <VerifyFirst />
      ) : (
        <form
          className="card form"
          onSubmit={async (e) => {
            e.preventDefault();
            setErr(null);
            try {
              await post('/teacher/texts', { title, language, level, passage, questions });
              setTitle('');
              setPassage('');
              setQuestions(blank());
              load();
            } catch (e) {
              setErr(code(e));
            }
          }}
        >
          <h2>{t('texts.new')}</h2>
          <label className="field"><span>{t('texts.title')}</span><input required maxLength={100} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <LevelLanguage level={level} language={language} onLevel={setLevel} onLanguage={setLanguage} />
          <label className="field">
            <span>{t('texts.passage')}</span>
            <textarea required rows={8} value={passage} onChange={(e) => setPassage(e.target.value)} aria-describedby="wc" />
            <small id="wc" className={words && (words < 40 || words > 250) ? 'hint hint--warn' : 'hint'}>{t('texts.wordCount', { n: words })}</small>
          </label>
          {questions.map((q, qi) => (
            <fieldset key={qi} className="field qbox">
              <legend>{t('texts.question', { n: qi + 1 })}</legend>
              <input required aria-label={t('texts.questionText', { n: qi + 1 })} value={q.q} onChange={(e) => setQ(qi, { q: e.target.value })} />
              {q.options.map((o, oi) => (
                <div key={oi} className="row">
                  <input type="radio" name={`ans${qi}`} checked={q.answer === oi} aria-label={t('texts.correctOption', { n: oi + 1 })} onChange={() => setQ(qi, { answer: oi })} />
                  <input required aria-label={t('texts.option', { n: oi + 1 })} placeholder={t('texts.option', { n: oi + 1 })} value={o} onChange={(e) => setQ(qi, { options: q.options.map((y, j) => (j === oi ? e.target.value : y)) })} />
                </div>
              ))}
            </fieldset>
          ))}
          <p className="hint">{t('texts.answerHint')}</p>
          <ErrorText code={err} />
          <button className="btn btn--primary" type="submit">{t('common.save')}</button>
        </form>
      )}
    </AdultLayout>
  );
}

type E4Item = OwnContent & { content: { sentence: string; pictures: Array<{ url: string; label: string }> } };
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 2 * 1024 * 1024;

const readAsDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

/** FR-CNT-05 — teacher sentence–picture items (E4): sentence, level, language, 3 pictures with labels. */
export function TeacherPictures() {
  const { t, lang: uiLang } = useI18n();
  const verified = useVerified();
  const [items, setItems] = useState<E4Item[]>([]);
  const [sentence, setSentence] = useState('');
  const [language, setLanguage] = useState<'en' | 'fi'>(uiLang);
  const [level, setLevel] = useState(1);
  const empty = () => [0, 1, 2].map(() => ({ image: '', label: '', fileError: null as string | null }));
  const [pics, setPics] = useState(empty);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const load = useCallback(() => get<E4Item[]>('/teacher/e4').then(setItems), []);
  useEffect(() => {
    load();
  }, [load]);

  const setPic = (i: number, patch: Partial<(typeof pics)[number]>) => setPics((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const onFile = async (i: number, f: File | undefined) => {
    if (!f) return setPic(i, { image: '', fileError: null });
    if (!ALLOWED_TYPES.includes(f.type)) return setPic(i, { image: '', fileError: 'image_type' });
    if (f.size > MAX_BYTES) return setPic(i, { image: '', fileError: 'image_too_large' });
    setPic(i, { image: await readAsDataUrl(f), fileError: null });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pics.some((p) => !p.image)) return setErr('three_pictures_required');
    setBusy(true);
    try {
      await post('/teacher/e4', { sentence, level, language, confirmNoPeople: confirm, pictures: pics.map((p) => ({ image: p.image, label: p.label })) });
      setSentence('');
      setPics(empty());
      setConfirm(false);
      setFormKey((k) => k + 1); // clears the file inputs
      load();
    } catch (e) {
      setErr(code(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdultLayout title={t('nav.pictures')}>
      <p className="hint">{t('e4.intro')}</p>
      {items.length > 0 && (
        <div className="e4-list">
          {items.map((x) => (
            <article key={x.id} className="card">
              <p><strong>{x.content.sentence}</strong></p>
              <p className="muted">
                {t('lang.' + x.language)} · {t('dash.level', { n: x.level })}
                {!x.active && <span className="badge">{t('content.hidden')}</span>}
              </p>
              <div className="e4-thumbs">
                {x.content.pictures.map((p, i) => (
                  <figure key={i}>
                    <img src={p.url} alt={p.label} loading="lazy" />
                    <figcaption>{i === 0 ? '✓ ' : ''}{p.label}</figcaption>
                  </figure>
                ))}
              </div>
              <ContentActions item={x} onChange={load} />
            </article>
          ))}
        </div>
      )}
      {!verified ? (
        <VerifyFirst />
      ) : (
        <form key={formKey} className="card form" onSubmit={submit} style={{ maxWidth: 'none' }}>
          <h2>{t('e4.new')}</h2>
          <label className="field">
            <span>{t('e4.sentence')}</span>
            <input required maxLength={200} value={sentence} onChange={(e) => setSentence(e.target.value)} />
          </label>
          <LevelLanguage level={level} language={language} onLevel={setLevel} onLanguage={setLanguage} />
          <div className="notice">
            <p><strong>{t('e4.rule')}</strong></p>
            <p className="hint">{t('e4.formats')}</p>
          </div>
          <div className="pic-upload">
            {pics.map((p, i) => (
              <fieldset key={i} className={`pic-upload__slot ${i === 0 ? 'pic-upload__slot--correct' : ''}`}>
                <legend><strong>{i === 0 ? t('e4.correct') : t('e4.distractor', { n: i })}</strong></legend>
                {p.image ? <img className="pic-upload__preview" src={p.image} alt={p.label || t('e4.previewAlt')} /> : <div className="pic-upload__empty" aria-hidden="true">🖼️</div>}
                <label className="field">
                  <span>{t('e4.file')}</span>
                  <input type="file" accept={ALLOWED_TYPES.join(',')} required onChange={(e) => onFile(i, e.target.files?.[0])} />
                </label>
                <ErrorText code={p.fileError} />
                <label className="field">
                  <span>{t('e4.label')}</span>
                  <input required maxLength={60} value={p.label} placeholder={i === 0 ? t('e4.labelExample') : ''} onChange={(e) => setPic(i, { label: e.target.value })} />
                </label>
              </fieldset>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" required checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            <span>{t('e4.confirm')}</span>
          </label>
          <ErrorText code={err} />
          <button className="btn btn--primary" type="submit" disabled={busy || pics.some((x) => x.fileError)}>
            {busy ? t('e4.uploading') : t('common.save')}
          </button>
        </form>
      )}
    </AdultLayout>
  );
}

/** DR-04 — teacher deletes their own account and everything in it. */
export function TeacherAccount() {
  const { t } = useI18n();
  const { me, refresh } = useSession();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  if (me?.kind !== 'teacher') return null;
  return (
    <AdultLayout title={t('nav.account')}>
      <div className="card">
        <p><strong>{me.teacher.name}</strong> · {me.teacher.email}</p>
        <p className="muted">{me.teacher.email_verified ? `✓ ${t('account.verified')}` : t('account.unverified')}</p>
        <p><Link to="/privacy">{t('footer.privacy')}</Link></p>
      </div>
      <form
        className="card form"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr(null);
          if (!window.confirm(t('account.deleteConfirm'))) return;
          try {
            await api('DELETE', '/teacher/account', { password });
            await refresh();
            nav('/');
          } catch (e) {
            setErr(code(e));
          }
        }}
      >
        <h2>{t('account.delete')}</h2>
        <p>{t('account.deleteWarning')}</p>
        <label className="field">
          <span>{t('common.password')}</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <ErrorText code={err} />
        <button className="btn btn--danger" type="submit">{t('account.delete')}</button>
      </form>
    </AdultLayout>
  );
}
