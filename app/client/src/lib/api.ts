export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

/** Friendly messages for the server's error codes. */
const MESSAGES: Record<string, string> = {
  wrong_login: 'That did not match. Check and try again.',
  too_many_attempts: 'Too many tries. Please wait 10 minutes and try again.',
  email_taken: 'An account with this e-mail already exists.',
  weak_password: 'The password must be at least 8 characters.',
  invalid_email: 'Please enter a valid e-mail address.',
  number_taken: 'Another student already has this student number.',
  invalid_number: 'Student numbers can use letters, digits, - and _ (no spaces).',
  unsupported_image: 'Please choose a PNG, JPEG, GIF or WebP picture.',
  unsupported_audio: 'This recording format is not supported.',
  file_too_large: 'The file is too big.',
  answer_not_in_options: 'The right answer must be one of the choices.',
  duplicate_options: 'Two choices are the same.',
  sentence_needs_gap: 'Each sentence needs a gap written as ___ (three underscores).',
  invalid_questions: 'Add between 1 and 8 questions.',
  invalid_items: 'Add between 2 and 6 pictures.',
  invalid_time_limit: 'The time limit must be 10–300 seconds.',
  no_exercises: 'There are no exercises of this kind yet.',
  not_logged_in: 'Please log in again.',
  network: 'No connection to the server. Check your internet and try again.',
};

export const errorText = (e: unknown) => {
  const code = e instanceof ApiError ? e.code : 'network';
  return MESSAGES[code] ?? (code.startsWith('invalid_') ? `Please check the ${code.slice(8)} field.` : 'Something went wrong. Please try again.');
};

export async function api<T = unknown>(method: string, path: string, body?: unknown, contentType?: string): Promise<T> {
  let res: Response;
  try {
    const raw = body instanceof Blob;
    res = await fetch('/api' + path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'Content-Type': contentType ?? (raw ? body.type || 'application/octet-stream' : 'application/json') },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && data?.error === 'not_logged_in') window.dispatchEvent(new Event('rb:unauthorized'));
    throw new ApiError(res.status, data?.error ?? 'error');
  }
  return data as T;
}

export const get = <T,>(p: string) => api<T>('GET', p);
export const post = <T,>(p: string, b?: unknown) => api<T>('POST', p, b ?? {});
export const put = <T,>(p: string, b: unknown) => api<T>('PUT', p, b);
export const del = <T,>(p: string) => api<T>('DELETE', p);
