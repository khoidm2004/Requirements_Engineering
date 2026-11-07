# ReadBuddy — Version A implementation

Implementation of [`specification_A.md`](../document/application_doc/specification/specification_A.md)
(Draft 1.7): a web application that helps children aged 6–12 with reading difficulties practise reading,
and lets **teachers** create classes, enrol students and follow their progress.

**Scope:** all *Must* and *Should* requirements, plus the cheap *Could* ones (FR-SUP-06 syllable colouring,
FR-PRG-04 CSV export). The other *Could* requirements are postponed as allowed by C-4
(see [Not implemented](#not-implemented-could-requirements)).

## Stack

| Part | Technology |
|------|------------|
| Server | Node.js ≥ 22.13, Express 5, TypeScript (run with `tsx`), SQLite via the built-in `node:sqlite` (no native modules), bcrypt (`bcryptjs`) |
| E4 pictures | Cloudinary (signed uploads, `CLOUDINARY_URL`) or a local folder served at `/media` for development |
| Client | React 19 + React Router, Vite, TypeScript; self-hosted fonts via `@fontsource` (Lexend, OpenDyslexic, Atkinson Hyperlegible) |
| Shared | `shared/syllables.ts` — syllabification used by E2 content, word help and syllable colouring |
| Tests | Vitest + Supertest (99 tests, ≈ 92 % statement coverage of server code) |

### Deviation from `architect_A.md`

The architecture document proposes Firebase (Auth, Firestore, Cloud Functions) + Cloudinary. This build
keeps a self-hosted Express + SQLite back end so that it runs and is tested without a Firebase project or
emulators; the SRS itself is technology-neutral (§2.1 only requires "hosted application platform, data
store, and serverless functions as needed"). Cloudinary is used as the architecture proposes, behind the
`ImageStore` interface in `server/src/images.ts`. The modules map onto the architecture's module
boundaries (`accounts` → `routes/auth.ts` + teacher roster routes, `content` → teacher texts / E4 + seed,
`progress` → `services.ts` dashboards and exports).

## Running

```bash
cd app
npm install
npm run dev            # API on :3000, client on http://localhost:5173
```

Production-style run (one process serves the API and the built client on port 3000):

```bash
npm run build && npm start
```

Other commands: `npm test`, `npm run coverage`.

**E-mail in development:** verification and password-reset e-mails are written to the `outbox` table and
the server log. Open <http://localhost:5173/dev/outbox> to copy the links (disabled when `NODE_ENV=production`).

Environment variables: `PORT` (3000), `DB_PATH` (`server/data/readbuddy.db`), `BASE_URL` (used in e-mail
links), `BREACHED_PASSWORDS_FILE` (optional newline-separated breached-password list, NFR-SEC-03),
`STATIC_DIR` (built client), `CLOUDINARY_URL` (`cloudinary://<key>:<secret>@<cloud>`; without it pictures go
to `MEDIA_DIR`, default `server/data/media`), `CLOUDINARY_FOLDER` (default `readbuddy-e4`).

**Upgrading from the earlier build:** the schema changed (guardians, admins and picture passwords are gone).
The server refuses to open an old database file — delete `server/data/readbuddy.db` and restart.

### Quick tour

1. Open the home page. It shows the **student** login by default; press **Teacher** → *Create an account*.
2. Open the verification link from the outbox, log in on the Teacher tab, create a class and enrol a student
   (name, student number, language, birth year).
3. Back on the home page (Student tab), sign in with that student number and name. The child sees
   **Today's practice** (3 exercises).
4. As the teacher, add a reading text (*Reading texts*) or a picture exercise with three uploaded pictures
   (*Picture exercises*), and assign it from the class page.

## Project layout

```
app/
├─ shared/syllables.ts            Finnish rule-based + English heuristic syllabification
├─ server/src/
│  ├─ db.ts                       schema (only DR-01 data), schema version check
│  ├─ domain/rules.ts             pure rules: adaptation, stars, placement, codes, settings, names/numbers
│  ├─ domain/passwords.ts         teacher password policy + hashing
│  ├─ images.ts                   E4 picture validation + Cloudinary / local image stores
│  ├─ services.ts                 access control, exercise selection, results, dashboards, exports, deletion
│  ├─ routes/{auth,teacher,child}.ts
│  ├─ jobs.ts                     daily retention jobs (DR-05) and housekeeping
│  └─ content/{banks,seed}.ts     seeded shared library (A-4, C-5)
├─ server/test/                   rules, content, images and API tests
└─ client/src/
   ├─ pages/Public.tsx            single home page (student + teacher login), registration, privacy
   ├─ pages/Teacher.tsx           classes, roster, student detail, texts, picture exercises, account
   ├─ child/                      child shell, today's practice, exercise player
   ├─ components/                 reading text (TTS highlight, word help, line focus, syllable colours), charts, …
   ├─ lib/                        api (+ offline queue), tts, sounds, i18n, session
   └─ i18n/{en,fi}.json           all UI text (NFR-MNT-01)
```

## Requirement coverage

| Requirement | Where / how |
|---|---|
| FR-ACC-00 single home page | `/` shows the student form; the *Teacher* tab (`/?teacher`) shows the teacher form on the same page; role-based redirect after login |
| FR-ACC-01/02 registration, verification (24 h) | `routes/auth.ts`; unverified teachers can log in but class/enrol/content routes return `email_not_verified` and the UI shows a verify prompt |
| FR-ACC-03 class + unique 6-char code | `generateClassCode` (unambiguous alphabet), unique index |
| FR-ACC-04 enrol (name, number, language, birth year) | `POST /teacher/classes/:id/students`; duplicate number → `student_number_in_use` (case-insensitive) |
| FR-ACC-05 child login, lockout | `POST /auth/student-login`; name case-insensitive; one generic error; 5 fails → 5 min lock |
| NFR-SEC-06 no number enumeration | failures are counted per *typed* number in `login_attempts`, so unknown numbers lock exactly like real ones |
| FR-ACC-06 idle timeout 20 / 30 min | enforced server-side per request + client idle timer |
| FR-ACC-07 reset link, single use, 1 h | `tokens` table; only verified addresses |
| FR-ACC-08 / DR-04 remove student | rows deleted immediately; `deletion_log` drives the 30-day backup purge |
| FR-ACC-09 locked indicator + unlock | roster *Login* column and student page; unlock clears the counter |
| FR-EX-01 E1–E5 | E1, E2, E3, E5 from the seeded library (levels 1–10, EN + FI); E4 only from teacher items at the child's level and language |
| FR-EX-02 spoken instruction + repeat button | `ExercisePlayer` |
| FR-EX-03 5–10 items / one passage | seed generator; E4 plays up to 10 teacher items of the same level/language together (see interpretations) |
| FR-EX-04 feedback without red / "wrong" | green + sound for correct, violet highlight + spoken answer (E4: the picture label) for reveal |
| FR-EX-05 second attempt | first miss → "try again"; second → reveal |
| FR-EX-06 adaptive difficulty | `nextLevel` (unit-tested: 3 rules + both boundaries) |
| FR-EX-07 initial placement + override | `initialLevel`; *Levels* editor on the student page |
| FR-EX-08 pause / resume ≤ 24 h | progress saved after every item (server + browser); E4 keeps the same item set |
| FR-EX-10 Today's practice | open assignments first, then lowest-accuracy types among those available |
| FR-SUP-01 TTS with word highlight | `lib/tts.ts`, `ReadingText` |
| FR-SUP-02..05 rate, typography, background, line focus | per-child settings, editable by child and teacher, applied live via CSS variables |
| FR-SUP-06 syllable colouring (*Could*) | `ColouredWord` in `ReadingText`, setting `syllableColours` |
| FR-SUP-07 word help | tap / Enter on a word → syllables, then whole word |
| FR-MOT-01 stars, FR-MOT-03 no comparison | `starsFor`; no other child's data is ever exposed to a child |
| FR-PRG-01 result recording | `results` table |
| FR-PRG-02 child detail | weekly time/count bars, levels, 12-week accuracy line per type, table view |
| FR-PRG-03 class overview | name, number, 7-day time & count, levels, inactivity + lock indicators; sortable by every column |
| FR-PRG-04 CSV export (*Could*) | `GET /teacher/classes/:id/overview.csv` (formula cells neutralised) |
| FR-CNT-01 assignments | type + level, own text or own E4 item; whole class or selected students; optional due date |
| FR-CNT-02 teacher texts | level + language required; offered to the teacher's students at matching E5 level/language |
| FR-CNT-03 shared library | seeded at start-up with stable keys; re-seeding updates in place, retires removed rows; no UI to edit it |
| FR-CNT-05 E4 items | 3 pictures + 1–5-word labels, JPEG/PNG/WebP ≤ 2 MB (checked by magic bytes), no-people confirmation; only image references stored; failed uploads are rolled back |
| NFR-US-01/03/04/05 | audio labels on login fields, 48 px targets, icons + audio labels on child screens, no visible timers |
| NFR-ACS-02/03 | keyboard operable (word navigation with arrows); left-aligned, ≤ 60 ch lines, no italics |
| NFR-REL-03 offline answers | results queued in `localStorage`, resent on reconnect (idempotent `clientId`) |
| NFR-SEC-01..04 | HSTS + Secure cookies in production, bcrypt, password policy, role and ownership checks on every route |
| NFR-PRV-01..04 | privacy notice (school context) + child audio version on every page; DR-01 data only; no third-party requests except the image host; TTS receives only text |
| NFR-MNT-01/02 | translation files; coverage ≈ 92 % |
| DR-05 inactivity deletion | `jobs.ts`: teacher e-mailed 30 days before; a login cancels it |
| DR-06 JSON export | *Download students' data* on the class page |

## Interpretations and assumptions

- **E4 exercise length (FR-EX-03 vs FR-CNT-05):** a teacher creates one sentence–picture *item* at a time.
  A child's E4 exercise is that item plus up to 9 more of the same level and language from the class
  teacher. If the teacher has made fewer than 5 such items, the exercise is shorter than 5 items, which is
  below the FR-EX-03 range. Teachers should create at least 5 items per level they use. This should be
  raised as an open issue in the SRS.
- **Picture order:** the correct picture is stored first and rotated per student and item when served, so
  it is not always in the same position.
- **Labels** are not shown as visible captions to the child (that would give away the answer); they are the
  `alt` text and are spoken when the correct picture is revealed.
- **Student-number uniqueness (A-5, AD-6):** platform-wide, compared case-insensitively.
- **One class per student:** a student is enrolled in exactly one class; teachers' own content is visible to
  the students of all of that teacher's classes.
- **Correct items:** an item counts as correct only when answered correctly on the **first** attempt.
- **"Consecutive exercises"** in FR-EX-06 are counted at the current level, since the last level change.
- **TTS provider:** the browser Web Speech API stands in for the external TTS service (A-1, **OI-1**).
  Only the text is sent (NFR-PRV-04). Some browsers' voices run in the cloud, outside the EEA (C-1); a
  server-side EEA TTS service can replace `lib/tts.ts`.
- **E-mail service:** the mailer is an interface with an outbox implementation; connect the real delivery
  service in `context.ts`.
- **Encryption at rest / EEA hosting (DR-02, C-1)** and **backups (NFR-REL-02)** are deployment concerns.
  Host the SQLite file on an encrypted EEA volume with daily backups, and purge subjects listed in
  `deletion_log` from backups within 30 days. Configure the Cloudinary account for EU storage (AD-7).
- **Timezone:** results are stored and grouped by week in UTC.

## Not implemented (*Could* requirements)

FR-EX-09 read-aloud / WCPM (also **OI-2**), FR-MOT-02 rewards shop, FR-CNT-04 TTS preview gate for teacher
content. The schema already has `results.wcpm` for when FR-EX-09 is picked up.

## Verification not covered by automated tests

NFR-US-01/02 (usability tests with children and teachers), NFR-ACS-01 (axe audit plus manual
screen-reader review), NFR-PERF-01..04 (load testing), NFR-SEC-05 (OWASP test) and a live Cloudinary
upload (the adapter is tested against a stubbed API) need to be run separately before release.
