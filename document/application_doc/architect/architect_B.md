# ReadBuddy — Architecture Document (Version B)

| Field | Value |
|-------|-------|
| Document | Software architecture |
| Product | ReadBuddy |
| Based on | [specification_B.md](../specification/specification_B.md) **only** |
| Status | Draft 1.2 |
| Date | 2026-10-31 |

This architecture is derived **from Spec B alone**. It does not import Version A rules, priorities, or constraints.  
The **core tech stack** is the same as Version A (React, Firebase, Cloudinary, one home page) only so the two implementations can be compared on equal technology footing. Version B adds Firebase Storage because Spec B asks to keep recordings.

Where Spec B is silent but the app cannot work without a decision, the choice is marked **(assumption)**.

---

## 1. Purpose and scope

- Turn Spec B’s informal bullets into a buildable structure.
- Use the agreed shared stack (see §3 and §6).
- Where Spec B is vague or self-contradictory, the architecture states a simple default and leaves it open.

**Out of scope:** anything Spec B marks TBD; detailed UI mockups; full API schema.

---

## 2. Drivers from Spec B

| Spec B | Design implication |
|--------|-------------------|
| Website; modern; user-friendly; **all devices** | Responsive React app (including phones) |
| Kids + teachers | Two roles after login |
| Teacher login; class code; add students by name + number | Teacher Auth + class/student records |
| Kids sign in with student number + name | Roster login (not e-mail) |
| Assign, texts, upload pictures for sentence–picture | Content + image upload |
| Many exercise types; auto difficulty | Exercise engine + per-kid level |
| Clear instructions; TTS + highlight | TTS integration + UI highlight |
| Fonts, colours, settings; dyslexia-friendly font | Per-kid settings |
| Say it’s wrong + show right answer | Explicit failure feedback |
| Save recordings for teachers later | Persist audio files |
| Points + leaderboard | Scores visible to kids |
| Time limits on exercises | Client-side timers |
| Teacher reports + export | Dashboard + CSV |
| Shared exercises with the app | Seeded content |
| Fast, secure, GDPR, keep all data, accessible, 24/7, many users | Vague NFRs — use platform defaults; note GDPR vs “keep all data” / Analytics tension |
| React + Firebase; Google Analytics?; English TBD | Stack fixed; Analytics optional; start with English |

---

## 3. System context

Same **shape and services** as the shared stack (for fair A/B comparison): one home page; Firebase for auth/data; Cloudinary for pictures.

```text
┌──────────────────────────────────────────────────┐
│  Child or Teacher (browser — all devices)        │
│  → one Home page (default: student login;        │
│    teacher login form on the same page)          │
└───────────────────────┬──────────────────────────┘
                        │ HTTPS
                        ▼
            ┌─────────────────────────┐
            │      ReadBuddy (B)      │
            │  React web client       │
            │  Cloud Functions        │
            │  Firebase Hosting       │
            └───────────┬─────────────┘
                        │
     ┌──────────┬───────┼────────┬──────────────┐
     ▼          ▼       ▼        ▼              ▼
┌─────────┐ ┌────────┐ ┌─────┐ ┌────────┐ ┌────────────┐
│ Firebase│ │Firestore│ │Cloud│ │ TTS    │ │ Firebase   │
│ Auth    │ │        │ │inary│ │        │ │ Storage    │
└─────────┘ └────────┘ └─────┘ └────────┘ └────────────┘
```

| Service | Used for (Spec B) |
|---------|-------------------|
| **Firebase Authentication** | Teacher login (req 1); registration **(assumption)** — Spec B does not say how teachers get accounts |
| **Cloud Firestore** | Classes, students, exercises, results, points, settings |
| **Cloudinary** | Teacher-uploaded sentence–picture images |
| **Firebase Storage** | Saved read-aloud recordings (req 13); recorded in the browser, no speech recognition needed |
| **TTS** | Read aloud / highlight (req 9) |
| **Google Analytics** | Optional per Spec B Technical — default **off** until GDPR clarified |

---

## 4. Containers

| Container | Role | Spec B |
|-----------|------|--------|
| React client | Home login, kid UI, teacher UI, timers, leaderboard | 1–16, 18 |
| Firebase Auth | Teachers | 1 |
| Firestore | App data | 2–7, 10, 14, 16–18 |
| Cloud Functions | Child login, TTS proxy, export helpers | 4, 9, 18 |
| Cloudinary | Picture uploads | 5 |
| Firebase Storage | Keep recordings | 13 |

### Modules

| Module | Spec B items |
|--------|----------------|
| `accounts` | 1–4 |
| `class` | 2–3, 5, 16, 18 |
| `exercises` | 5–8, 12, 15, 17 |
| `support` | 9–11 |
| `motivation` | 14 |
| `recordings` | 13 |
| `progress` | 16, 18 |

---

## 5. Authentication (from Spec B)

| Who | Method (unchanged intent) |
|-----|---------------------------|
| Teacher | E-mail + password via **Firebase Authentication** **(assumption)** — Spec B only says "log in" |
| Child | **Student number + name** checked in Firestore |

### Single home page (stack convention)

One URL for the class:

- **Default:** student login (number + name)
- **Same page:** teacher login form
- Then: kid practice screen or teacher dashboard

```text
Teacher: home → teacher form → Firebase Auth → create class → add students
Child:   home → student number + name → practice
```

---

## 6. Tech stack (core shared with Version A for comparison)

| Layer | Choice |
|-------|--------|
| UI | React + TypeScript |
| Hosting | Firebase Hosting |
| Auth | Firebase Authentication (teachers) |
| Database | Cloud Firestore |
| Functions | Cloud Functions (Node.js) |
| Images | Cloudinary |
| Recordings | Firebase Storage (B only) |
| TTS | External or browser API |
| i18n | English first (Spec B); other languages later |
| Fonts | Dyslexia-friendly default + kid settings |
| Analytics | Optional Google Analytics — **not enabled by default** |

---

## 7. Security / privacy (as Spec B allows)

Spec B asks for secure + GDPR **and** “keep all data” **and** possibly Analytics. Practical defaults:

- HTTPS, Firebase Auth, Firestore/Storage rules (teacher vs child)
- Store what Spec B asks for (results, recordings, points)
- Retention / Analytics: **open** (see §12)
- Recordings: teacher-readable only

---

## 8. Data (logical)

| Store | Content | Spec B |
|-------|---------|--------|
| `teachers` | Auth-linked profile | 1 |
| `classes` | Code, owner | 2 |
| `students` | Name, number, level, settings | 3–4, 7, 10 |
| `exercises` | Shared seed + teacher texts / picture items | 5–6, 17 |
| `results` | Scores, times | 7, 15–16 |
| points / leaderboard | Motivation | 14 |
| Cloudinary URLs | Pictures | 5 |
| Storage paths | Read-aloud audio | 13 |

---

## 9. Flows

1. **Setup:** Teacher logs in → class code → add students.  
2. **Practice:** Kid logs in → adaptive exercises → TTS/highlight → timer → “wrong” + correct answer → points / leaderboard.  
3. **Content:** Teacher adds text and/or pictures (Cloudinary) → assign.  
4. **Recordings:** Kid records → save to Storage → teacher listens later.  
5. **Reports:** Teacher views progress → export CSV.

---

## 10. Deployment

Firebase Hosting + Auth + Firestore (+ Storage); Cloudinary for images; separate `dev` / `prod` projects or prefixes; secrets outside the repo.

---

## 11. Spec B → architecture

| Spec B # | Where |
|----------|--------|
| 1–4 | §5 |
| 5, 17 | Cloudinary + Firestore seed/content |
| 6–8, 12, 15 | `exercises` |
| 9–11 | TTS + settings |
| 13 | Firebase Storage |
| 14 | Leaderboard |
| 16, 18 | Teacher reports / export |
| 19 | Backlog |
| Technical | §3, §6 |

---

## 12. Open issues (from Spec B)

| ID | Issue |
|----|-------|
| B-1 | Google Analytics vs GDPR |
| B-2 | “Keep all data” vs GDPR minimisation / retention |
| B-3 | No measurable “fast” / “24/7” / “lots of users” |
| B-4 | Languages beyond English |
| B-5 | Out of scope still TBD |

---

## 13. Related

- [specification_B.md](../specification/specification_B.md) — sole requirements source for this document  
- [architect_A.md](./architect_A.md) — same tech stack only; different requirements source  
