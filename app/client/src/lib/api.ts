export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

/** JSON API call. Errors come back as ApiError with the server's error code. */
export async function api<T = unknown>(method: string, path: string, body?: unknown, passive = false): Promise<T> {
  const res = await fetch('/api' + path, {
    method,
    credentials: 'same-origin',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(passive ? { 'X-Activity': 'passive' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && data?.error === 'not_logged_in') window.dispatchEvent(new Event('rb:unauthorized'));
    throw new ApiError(res.status, data?.error ?? 'error');
  }
  return data as T;
}

export const get = <T,>(p: string) => api<T>('GET', p);
export const post = <T,>(p: string, b?: unknown) => api<T>('POST', p, b ?? {});

// ---------- NFR-REL-03: keep results in the browser while offline ----------
const QUEUE_KEY = 'rb_pending_results';

export interface PendingResult {
  exerciseId: number;
  items: number;
  correct: number;
  durationS: number;
  clientId: string;
}

function readQueue(): PendingResult[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function writeQueue(q: PendingResult[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* storage unavailable */
  }
}

export interface ResultResponse {
  stars: number;
  totalStars?: number;
  levelChange: number;
}

/** Submit a result; if the network is down it is queued and sent when the connection returns. */
export async function submitResult(r: PendingResult): Promise<ResultResponse | null> {
  writeQueue([...readQueue().filter((x) => x.clientId !== r.clientId), r]);
  try {
    const out = await post<ResultResponse>('/child/results', r);
    writeQueue(readQueue().filter((x) => x.clientId !== r.clientId));
    return out;
  } catch (e) {
    if (e instanceof ApiError && e.status !== 401) writeQueue(readQueue().filter((x) => x.clientId !== r.clientId));
    return null; // offline (or session ended): stays queued
  }
}

export async function flushResults() {
  for (const r of readQueue()) {
    try {
      await post('/child/results', r);
      writeQueue(readQueue().filter((x) => x.clientId !== r.clientId));
    } catch (e) {
      if (e instanceof ApiError && e.status !== 401) writeQueue(readQueue().filter((x) => x.clientId !== r.clientId));
      else return;
    }
  }
}

export const newClientId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
