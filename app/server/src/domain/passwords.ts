import { readFileSync, existsSync } from 'node:fs';
import bcrypt from 'bcryptjs';

/**
 * NFR-SEC-03 — teacher passwords: ≥ 10 characters and not in a list of known breached passwords.
 * A small built-in list is always checked; set BREACHED_PASSWORDS_FILE to a newline-separated
 * list (for example a top-100k list from a breach corpus) to extend it in production.
 */
const BUILTIN = [
  '1234567890', '12345678910', '123456789a', '0123456789', '0987654321', '1111111111', '1q2w3e4r5t',
  'qwertyuiop', 'qwerty1234', 'qwerty12345', 'asdfghjkl1', 'password12', 'password123', 'password1234',
  'passw0rd123', 'iloveyou12', 'iloveyou123', 'abcdefghij', 'abcd123456', 'abc1234567', 'welcome123',
  'letmein123', 'monkey1234', 'dragon1234', 'football12', 'baseball12', 'superman12', 'sunshine12',
  'princess12', 'trustno1234', 'starwars12', 'whatever12', 'changeme12', 'administrator', 'aaaaaaaaaa',
  'salasana123', 'salasana12', 'salasana1234', 'perkele123', 'hyvää päivää', 'qwertyuiop123',
  'zaq12wsxcde', '1qaz2wsx3edc', 'q1w2e3r4t5', 'mypassword', 'mypassword1', 'readbuddy123', 'readbuddy1',
];

let breached: Set<string> | null = null;
function list(): Set<string> {
  if (breached) return breached;
  breached = new Set(BUILTIN);
  const file = process.env.BREACHED_PASSWORDS_FILE;
  if (file && existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) if (line) breached.add(line.toLowerCase());
  }
  return breached;
}

/** Returns an error code, or null if the password is acceptable. */
export function checkTeacherPassword(pw: unknown): 'too_short' | 'breached' | null {
  if (typeof pw !== 'string' || [...pw].length < 10) return 'too_short';
  if (list().has(pw.toLowerCase())) return 'breached';
  return null;
}

/** NFR-SEC-02 — salted hashes (bcrypt). Cost lowered in tests for speed. */
const COST = process.env.NODE_ENV === 'test' ? 4 : 12;
export const hash = (s: string) => bcrypt.hashSync(s, COST);
export const verify = (s: string, h: string) => bcrypt.compareSync(s, h);
