import { useState, type FormEvent } from 'react';
import { api, del, errorText, get, post } from '../lib/api';
import { TYPE_INFO, type Exercise } from '../lib/types';
import { Card, ErrorBox, Loading, fmtDate, useLoad } from '../components/Ui';
import { Preview, itemCount } from './Library';

const MAX_IMAGE = 5 * 1024 * 1024;

function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const LevelSelect = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
  <label className="field field--inline">
    <span>Level</span>
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>{l}</option>)}
    </select>
  </label>
);

interface Q { question: string; answer: string; wrong1: string; wrong2: string }
const emptyQ = (): Q => ({ question: '', answer: '', wrong1: '', wrong2: '' });

/** Req 5: teachers add their own texts (read aloud, record, answer questions). */
function TextForm({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState(1);
  const [limit, setLimit] = useState(60);
  const [text, setText] = useState('');
  const [qs, setQs] = useState<Q[]>([emptyQ()]);
  const [err, setErr] = useState<unknown>(null);
  const [ok, setOk] = useState(false);
  const setQ = (i: number, k: keyof Q, v: string) => setQs(qs.map((q, j) => (j === i ? { ...q, [k]: v } : q)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    try {
      await post('/teacher/exercises', {
        type: 'stories', level, title,
        content: {
          text, timeLimitS: limit,
          questions: qs.map((q) => ({
            question: q.question, answer: q.answer.trim(),
            options: shuffle([q.answer, q.wrong1, q.wrong2].map((s) => s.trim()).filter(Boolean)),
          })),
        },
      });
      setTitle(''); setText(''); setQs([emptyQ()]); setOk(true);
      onSaved();
    } catch (x) {
      setErr(x);
    }
  }

  const words = text.split(/\s+/).filter(Boolean).length;
  return (
    <form onSubmit={submit} className="form">
      <div className="inline-form">
        <label className="field grow"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100} /></label>
        <LevelSelect value={level} onChange={setLevel} />
        <label className="field field--inline"><span>Seconds per question</span>
          <input type="number" min={10} max={300} value={limit} onChange={(e) => setLimit(Number(e.target.value))} required className="num" />
        </label>
      </div>
      <label className="field">
        <span>Text <span className="muted small">({words} words)</span></span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} required maxLength={5000} />
      </label>
      <fieldset className="questions">
        <legend>Questions (1–8)</legend>
        {qs.map((q, i) => (
          <div key={i} className="q-row">
            <label className="field grow"><span>Question {i + 1}</span><input value={q.question} onChange={(e) => setQ(i, 'question', e.target.value)} required maxLength={200} /></label>
            <label className="field"><span>Right answer</span><input value={q.answer} onChange={(e) => setQ(i, 'answer', e.target.value)} required maxLength={120} /></label>
            <label className="field"><span>Wrong answer</span><input value={q.wrong1} onChange={(e) => setQ(i, 'wrong1', e.target.value)} required maxLength={120} /></label>
            <label className="field"><span>Wrong answer (optional)</span><input value={q.wrong2} onChange={(e) => setQ(i, 'wrong2', e.target.value)} maxLength={120} /></label>
            {qs.length > 1 && <button type="button" className="btn btn--ghost btn--small" onClick={() => setQs(qs.filter((_, j) => j !== i))} aria-label={`Remove question ${i + 1}`}>✕</button>}
          </div>
        ))}
        {qs.length < 8 && <button type="button" className="btn btn--small" onClick={() => setQs([...qs, emptyQ()])}>+ Add question</button>}
      </fieldset>
      <ErrorBox error={err} />
      {ok && <p className="alert alert--ok" role="status">Saved! Your students can now find it in Stories and Read aloud.</p>}
      <button className="btn btn--primary">Save text</button>
    </form>
  );
}

interface PicItem { sentence: string; imageId: number | null; preview: string | null; uploading: boolean; error: string | null }
const emptyPic = (): PicItem => ({ sentence: '', imageId: null, preview: null, uploading: false, error: null });

/** Req 5: sentence–picture exercises with the teacher's own pictures. */
function PictureForm({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState(1);
  const [items, setItems] = useState<PicItem[]>([emptyPic(), emptyPic(), emptyPic()]);
  const [err, setErr] = useState<unknown>(null);
  const [ok, setOk] = useState(false);
  const update = (i: number, patch: Partial<PicItem>) => setItems((cur) => cur.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  async function upload(i: number, file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_IMAGE) return update(i, { error: 'The picture is too big (max 5 MB).' });
    update(i, { uploading: true, error: null, preview: URL.createObjectURL(file) });
    try {
      const { id } = await api<{ id: number }>('POST', '/teacher/images', file);
      update(i, { imageId: id, uploading: false });
    } catch (x) {
      update(i, { uploading: false, imageId: null, preview: null, error: errorText(x) });
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    if (items.some((it) => !it.imageId)) return setErr('Please add a picture for every sentence.');
    try {
      await post('/teacher/exercises', {
        type: 'pictures', level, title,
        content: { items: items.map((it) => ({ sentence: it.sentence, picture: { imageId: it.imageId } })) },
      });
      setTitle(''); setItems([emptyPic(), emptyPic(), emptyPic()]); setOk(true);
      onSaved();
    } catch (x) {
      setErr(x);
    }
  }

  return (
    <form onSubmit={submit} className="form">
      <p className="muted small">Kids read each sentence and pick the matching picture from all the pictures in this exercise. Add 2–6 sentences, each with its own picture.</p>
      <div className="inline-form">
        <label className="field grow"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100} /></label>
        <LevelSelect value={level} onChange={setLevel} />
      </div>
      <div className="pic-items">
        {items.map((it, i) => (
          <div key={i} className="pic-item">
            <div className="pic-item__img">
              {it.preview ? <img src={it.preview} alt="" /> : <span aria-hidden="true">🖼️</span>}
            </div>
            <label className="field">
              <span>Picture {i + 1}</span>
              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(e) => upload(i, e.target.files?.[0])} />
            </label>
            {it.uploading && <span className="muted small">Uploading…</span>}
            {it.error && <span className="alert alert--error small">{it.error}</span>}
            <label className="field">
              <span>Sentence</span>
              <input value={it.sentence} onChange={(e) => update(i, { sentence: e.target.value })} required maxLength={200} />
            </label>
            {items.length > 2 && <button type="button" className="btn btn--ghost btn--small" onClick={() => setItems(items.filter((_, j) => j !== i))}>Remove</button>}
          </div>
        ))}
      </div>
      {items.length < 6 && <button type="button" className="btn btn--small" onClick={() => setItems([...items, emptyPic()])}>+ Add sentence</button>}
      <ErrorBox error={err} />
      {ok && <p className="alert alert--ok" role="status">Saved! You can find it in the library and assign it.</p>}
      <button className="btn btn--primary" disabled={items.some((it) => it.uploading)}>Save picture exercise</button>
    </form>
  );
}

export function MyContent() {
  const [tab, setTab] = useState<'text' | 'pictures'>('text');
  const mine = useLoad(() => get<Exercise[]>('/teacher/exercises').then((all) => all.filter((e) => !e.shared)));
  const [preview, setPreview] = useState<Exercise | null>(null);

  async function archive(e: Exercise) {
    if (!confirm(`Remove “${e.title}”? Students will no longer see it. Results already done are kept.`)) return;
    await del(`/teacher/exercises/${e.id}`);
    mine.reload();
  }

  return (
    <div className="page">
      <h1>My texts &amp; pictures</h1>
      <Card>
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'text'} className={`tab ${tab === 'text' ? 'tab--on' : ''}`} onClick={() => setTab('text')}>📖 New text</button>
          <button role="tab" aria-selected={tab === 'pictures'} className={`tab ${tab === 'pictures' ? 'tab--on' : ''}`} onClick={() => setTab('pictures')}>🖼️ New sentence–picture exercise</button>
        </div>
        {tab === 'text' ? <TextForm onSaved={mine.reload} /> : <PictureForm onSaved={mine.reload} />}
      </Card>

      <Card title="My exercises">
        <ErrorBox error={mine.error} />
        {!mine.data ? <Loading /> : mine.data.length === 0 ? <p className="muted">You have not added anything yet.</p> : (
          <div className="ex-grid">
            {mine.data.map((e) => (
              <article key={e.id} className="ex-card">
                <div className="ex-card__icon" aria-hidden="true">{TYPE_INFO[e.type].icon}</div>
                <div className="ex-card__body">
                  <h3>{e.title}</h3>
                  <p className="muted small">{TYPE_INFO[e.type].label} · level {e.level} · {itemCount(e)} questions · {fmtDate(e.createdAt)}</p>
                </div>
                <div className="ex-card__actions">
                  <button type="button" className="btn btn--small" onClick={() => setPreview(e)}>Preview</button>
                  <button type="button" className="btn btn--small btn--danger" onClick={() => archive(e)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Card>
      {preview && <Preview exercise={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
