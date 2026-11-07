import type { Ctx } from './context.js';
import { iso } from './context.js';
import { deleteStudent } from './services.js';

const DAY = 86_400_000;
const MONTH = 30 * DAY;

/**
 * DR-05 — data of a child with no login for 24 months is deleted after the responsible teacher
 * has been notified by e-mail 30 days in advance. A child who never logged in counts from enrolment.
 * Housekeeping — expired tokens, stale sessions, paused exercises older than 24 h (FR-EX-08) and
 * old failed-login counters are removed.
 */
export function runDailyJobs(ctx: Ctx) {
  const { db } = ctx;
  const now = ctx.now();
  const lastActivity = 'COALESCE(s.last_login_at, s.created_at)';

  const toNotify = db
    .prepare(
      `SELECT s.id, s.name, s.student_number, c.name AS class_name, t.id AS teacher_id, t.email
       FROM students s JOIN classes c ON c.id = s.class_id JOIN teachers t ON t.id = c.teacher_id
       WHERE s.inactivity_notified_at IS NULL AND ${lastActivity} < ?
       ORDER BY t.id, c.name, s.name`,
    )
    .all(iso(now - 24 * MONTH + 30 * DAY)) as Array<{
    id: number; name: string; student_number: string; class_name: string; teacher_id: number; email: string;
  }>;
  const byTeacher = new Map<string, typeof toNotify>();
  for (const s of toNotify) byTeacher.set(s.email, [...(byTeacher.get(s.email) ?? []), s]);
  for (const [email, students] of byTeacher) {
    ctx.mailer.send(
      email,
      'ReadBuddy: student data will be deleted in 30 days',
      `The following students have not logged in to ReadBuddy for almost 24 months. To protect their privacy, their data will be deleted in 30 days unless they log in before then:\n\n` +
        students.map((s) => `- ${s.name} (${s.student_number}), class ${s.class_name}`).join('\n') +
        `\n\nYou can download their data from the class page before it is deleted: ${ctx.baseUrl}/teacher\n`,
    );
  }
  const mark = db.prepare('UPDATE students SET inactivity_notified_at = ? WHERE id = ?');
  for (const s of toNotify) mark.run(iso(now), s.id);

  const toDelete = db
    .prepare(
      `SELECT s.id FROM students s
       WHERE s.inactivity_notified_at IS NOT NULL AND s.inactivity_notified_at <= ? AND ${lastActivity} < ?`,
    )
    .all(iso(now - 30 * DAY), iso(now - 24 * MONTH)) as Array<{ id: number }>;
  for (const s of toDelete) deleteStudent(db, s.id);

  db.prepare('DELETE FROM tokens WHERE expires_at < ?').run(iso(now - DAY));
  db.prepare('DELETE FROM sessions WHERE last_seen < ?').run(now - DAY);
  db.prepare('DELETE FROM progress WHERE updated_at < ?').run(now - DAY);
  db.prepare('DELETE FROM login_attempts WHERE updated_at < ? AND (locked_until IS NULL OR locked_until < ?)').run(now - DAY, iso(now));
  return { notified: toNotify.length, deletedStudents: toDelete.length };
}
