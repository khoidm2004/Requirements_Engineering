# ReadBuddy — Version B implementation

Implementation of [`specification_B.md`](../document/application_doc/specification/specification_B.md)
(informal requirements), following [`architect_B.md`](../document/application_doc/architect/architect_B.md).
Only Spec B was used as the source of behaviour. Version A's rules were not carried over.

## Stack

Same stack as the Version A implementation, so the two can be compared fairly:

| Part | Technology |
|------|------------|
| Server | Node.js ≥ 22.13, Express 5, TypeScript (run with `tsx`), SQLite via built-in `node:sqlite`, `bcryptjs` |
| Client | React 19 + React Router, Vite, TypeScript; self-hosted fonts (OpenDyslexic, Lexend, Atkinson Hyperlegible) |
| Files | Pictures and recordings go through a `Storage` interface (`server/src/storage.ts`); the default keeps them on disk |
| Tests | Vitest + Supertest (42 tests) |

The architecture names Firebase, Cloudinary and Firebase Storage. Version A was built on Express + SQLite,
so B uses the same stack. Cloudinary and Firebase Storage map onto the `Storage` interface.

## Running

```bash
cd app
npm install
npm run dev            # API on :3000, client on http://localhost:5173
```

Production-style (one process serves the API and the built client on port 3000):

```bash
npm run build && npm start
```

Other commands: `npm test`, `npm run coverage`, `npm run typecheck`.

Environment variables: `PORT` (3000), `DATA_DIR` (`server/data`, holds the database and uploaded files),
`DB_PATH`, `STATIC_DIR`.

### Quick tour

1. Open the home page, choose **I’m a teacher**, create an account, create a class and add students
   (name + student number).
2. In another browser (or a private window), sign in on the default **student** form with a student
   number and name, then practise.
3. Back as the teacher: assign exercises from the **Exercise library**, add texts and pictures under
   **My texts & pictures**, open a student to see results and listen to recordings, and export CSV.

## Project layout

```
app/
├─ server/src/
│  ├─ db.ts                schema
│  ├─ domain/rules.ts      exercise types, content validation, scoring/points, levels, settings
│  ├─ services.ts          ownership checks, exercise picking, leaderboard, reports, CSV
│  ├─ storage.ts           file storage + file-type detection
│  ├─ routes/auth.ts       teacher register/login, student login (number + name)
│  ├─ routes/teacher.ts    classes, students, exercises, pictures, assignments, recordings, export
│  ├─ routes/student.ts    practice, results, settings, leaderboard, texts, recordings, images
│  └─ content/             shared exercises that come with the app (55, levels 1–5)
├─ server/test/            rules, content and API tests
└─ client/src/
   ├─ pages/Home.tsx       one home page: student login by default, teacher login on the same page
   ├─ pages/Kid.tsx        kid home, practice, read-aloud + recording, leaderboard, settings
   ├─ pages/*.tsx          teacher: classes, class report, student report, library, own content
   ├─ components/          exercise player, read-aloud with word highlight, UI helpers
   └─ lib/                 api, session, TTS, settings
```

## Requirement coverage (Spec B)

| # | Requirement | Where / how |
|---|-------------|-------------|
| 1 | Teachers log in | E-mail + password (bcrypt), `routes/auth.ts` |
| 2 | Class group with a code | 6-character code without look-alike characters |
| 3 | Add students manually (name + number) | Class page form |
| 4 | Kids sign in with number + name | Default form on the home page; name matching ignores case and extra spaces |
| 5 | See kids + results, assign, own texts, upload pictures | Class/student reports; assignments to class or chosen kids with due date; story texts with questions; sentence–picture exercises with uploaded pictures |
| 6 | Many exercise types and levels | Letters, words, sentences, sentence–picture, stories; levels 1–5 |
| 7 | Automatic difficulty | Per kid and per type: ≥ 80 % → level up, < 50 % → level down. Teachers can override |
| 8 | Clear instructions | Intro screen with steps and time limit, read-aloud button, short instruction on every question |
| 9 | Read aloud with highlighting | Web Speech API, spoken word highlighted, tap a word to hear it |
| 10 | Kids change font, colours, size, … | Font, size, letter and line spacing, colour themes + custom colours, highlight colour, voice speed; applies to the whole kid area and saves automatically |
| 11 | Dyslexia-friendly font | OpenDyslexic is the default |
| 12 | Say it is wrong + show the right answer | “❌ Wrong!” + right answer shown and spoken; summary lists the corrections |
| 13 | Record reading, saved for teachers | MediaRecorder in the browser → upload → teacher listens on the student page (“new” until played) |
| 14 | Points + leaderboard | 10 points per right answer + up to 5 speed bonus; class leaderboard (this week / all time) |
| 15 | Time limits | Countdown per question (letters 15 s, words 20 s, sentences/pictures 30 s, stories 60 s; teacher texts set their own). Time out = wrong |
| 16 | Progress reports | Class table (points, exercises, average score, levels, time, last active, recordings) and student page (levels, chart, all answers with timings) |
| 17 | Shared exercises | 55 seeded exercises (`content/bank.ts`) |
| 18 | Export data | Students CSV and all-results CSV per class |
| 19 | Later features | Not in scope |

Non-functional requirements: login rate limiting, HttpOnly SameSite session cookies, a strict
Content-Security-Policy, file types checked by content, owner checks on every route, CSV formula
injection blocked, keyboard-usable controls with labels, responsive layout down to phone width.

## Interpretations and assumptions (Spec B is silent or unclear)

- **Teacher accounts:** open self-registration (architecture §3 assumption).
- **Student login:** number + name only, as the architecture says. So student numbers are unique
  across the whole app. The class code identifies the class for the teacher but is not needed to log in.
- **“Keep all data” vs GDPR (B-2):** results keep every answer with its timing, and teacher exercises are
  archived instead of deleted. A teacher can remove a student, which deletes that student’s data and
  recordings, to handle erasure requests.
- **Google Analytics (B-1):** not included until the GDPR question is settled.
- **Leaderboard:** shows kids in the same class (names + points). Spec B asks for it; its privacy effect
  is noted on the privacy page.
- **Levels:** only an exercise at the kid’s current level changes the level. Assigned exercises at other
  levels do not.
- **Stories:** reading the story is not timed. Each question is.
- **TTS:** the browser’s voice (architecture: “external or browser API”).
- **Emoji pictures:** seeded pictures and icons are emoji, so they depend on the device’s emoji font.
- **Fast / 24/7 / lots of users (B-3):** no measurable targets in Spec B, so no specific work was done.

## Verification not covered by automated tests

Usability with kids, accessibility audit, load/availability testing and microphone recording on real
devices (recording was not exercised in the headless browser check).
