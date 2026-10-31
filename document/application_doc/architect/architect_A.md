# ReadBuddy — Architecture Document

| Field | Value |
|-------|-------|
| Document | Software architecture |
| Product | ReadBuddy |
| Based on | [specification_A.md](../specification/specification_A.md) |
| Status | Draft 1.9 |
| Date | 2026-10-31 |

This document describes **how** ReadBuddy can be built to satisfy Version A. Requirements stay in the SRS; technology choices and structure live here.

---

## 1. Purpose and scope

- Derive a system architecture from Spec A (product perspective, constraints C-1–C-5, NFRs, data requirements).
- Propose a tech stack suitable for a 5-person, 12-week student team (C-4).
- Stay implementation-independent enough that the stack can change without rewriting the SRS.

**Out of scope:** detailed UI mockups; full API schema; database DDL.

---

## 2. Architectural drivers (from Spec A)

| Driver | Source | Implication |
|--------|--------|-------------|
| Browser client + hosted back-end services; no native install | §2.1, C-2 | Single web app; responsive layout for desktop and tablets ≥ 9″ |
| External TTS and e-mail via public APIs | §2.1, A-1, A-2 | Integration adapters; no in-house TTS/mail stack |
| No school SIS; teacher-managed roster | §2.1, FR-ACC-03–04 | Classes + manual student enrolment (name + student number) |
| Two roles only: child and teacher | §2.3 | Simple RBAC |
| Shared content pre-seeded | A-4, C-5, FR-CNT-03 | Seed E1, E2, E3, E5 for levels 1–10 in EN + FI |
| Teacher E4 picture upload | FR-CNT-05, A-6 | Store images in Cloudinary; Firestore keeps references, labels, level, language |
| Personal data in EEA, encrypted at rest | C-1, DR-02 | Hosting and DB regions in EEA only |
| UI and exercises in English and Finnish | C-3, FR-ACC-04, FR-EX-01 | i18n layer; content keyed by language |
| Child login = student number + name | FR-ACC-05 | Roster match; lockout; generic errors (NFR-SEC-06) |
| Teacher auth = e-mail + password | FR-ACC-01–02, -07 | **Firebase Authentication** |
| App data persistence | DR-01–06 | **Cloud Firestore** (Firebase) |
| Single home page for both roles | FR-ACC-00 | One route; student form default (§5.1) |
| Breached-password check for teachers | NFR-SEC-03 | Sign-up goes through a Cloud Function that checks the password before creating the account |
| No third-party analytics / ads / tracking | NFR-PRV-03 | No Firebase Analytics / GA (NFR-PRV-03) |
| TTS text must not include child identifiers | NFR-PRV-04 | Sanitize payloads before TTS calls |
| Offline answers during network loss | NFR-REL-03 | Client-side buffer of in-progress exercise answers |
| RPO 24 h / RTO 8 h | NFR-REL-02 | Daily backups; documented restore path |
| ~2,000 concurrent users; LCP ≤ 2.5 s on 5 Mbit/s | NFR-PERF-01, -04 | Stateless API, CDN for static assets |
| TTS starts within 1 s (95 %) | NFR-PERF-02 | Prefer streaming TTS or short-phrase cache |
| Read-aloud audio not retained | FR-EX-09, DR-03 | Ephemeral processing; delete immediately after WCPM |
| WCAG 2.2 AA, keyboard-only, dyslexia-friendly text | NFR-ACS-01–03 | Accessibility-first front end |

---

## 3. System context

Child and teacher open the **same** ReadBuddy home page in the browser. Default UI is student login; teachers use the teacher form on that page. Auth and data use **Firebase**; E4 images use **Cloudinary**.

```text
┌──────────────────────────────────────────────────┐
│  Child or Teacher (browser)                      │
│  → one Home page (default: student login;        │
│    teacher login form on the same page)          │
└───────────────────────┬──────────────────────────┘
                        │ HTTPS (TLS ≥ 1.2)
                        ▼
            ┌─────────────────────────┐
            │      ReadBuddy          │
            │  Web client             │
            │  (+ Cloud Functions API │
            │   where needed)         │
            │  Firebase Hosting (EU)  │
            └───────────┬─────────────┘
                        │
     ┌──────────┬───────┼────────┬──────────────┐
     ▼          ▼       ▼        ▼              ▼
┌─────────┐ ┌────────┐ ┌─────┐ ┌────────┐ ┌────────────┐
│ Firebase│ │Firebase│ │Cloud│ │ TTS    │ │ E-mail /   │
│ Auth    │ │Firestore│ │inary│ │ EN/FI  │ │ STT (opt.) │
│(teacher)│ │ (data) │ │(E4) │ │        │ │            │
└─────────┘ └────────┘ └─────┘ └────────┘ └────────────┘
```

| External service | Role |
|------------------|------|
| **Firebase Authentication** | Teacher register / login / password reset / e-mail verification |
| **Cloud Firestore** | Classes, students, exercises, results, Cloudinary refs, settings |
| **Cloudinary** | Teacher-uploaded E4 pictures |
| TTS / e-mail / optional STT | Unchanged from Spec A dependencies |

Do **not** enable Firebase Analytics (conflicts with NFR-PRV-03).

---

## 4. Logical view (containers)

| Container | Responsibility | Maps to Spec A |
|-----------|----------------|----------------|
| **Web client** | Single home/login page + role-specific screens after auth; local answer buffer; settings; TTS highlight sync | FR-ACC, FR-EX, FR-SUP, FR-MOT, FR-PRG, FR-CNT, NFR-REL-03, §5.1 |
| **Firebase Authentication** | Teacher identity (e-mail + password) | FR-ACC-01–02, -07; NFR-SEC-02–03 |
| **Cloud Firestore** | All application data (teachers’ profiles, classes, students, content, results, image refs) | DR-01–06, FR-CNT-05 |
| **Cloud Functions** (as needed) | Child roster login (custom token or session), privileged writes, TTS proxy, scheduled jobs | FR-ACC-05, NFR-SEC-04–06, DR-05 |
| **Cloudinary** | Host teacher-uploaded E4 images; HTTPS delivery | FR-CNT-05, A-6 |
| **TTS adapter** | Call external TTS; strip identifiers; map word timings | FR-SUP-01–02, NFR-PRV-04, NFR-PERF-02 |
| **Mail** | Prefer Firebase Auth e-mail flows for verify/reset; optional extra mail API for DR-05 notices | FR-ACC-01–02, -07, DR-05 |
| **Speech adapter (Could)** | Stream audio for WCPM; discard after compute | FR-EX-09, DR-03 |

### Suggested module boundaries (client + Functions)

| Module | Main requirements |
|--------|-------------------|
| `accounts` | FR-ACC-00–09 (home page, Firebase Auth, Firestore roster, lock/unlock) |
| `exercises` | FR-EX-01–10 |
| `support` | FR-SUP-01–07 |
| `motivation` | FR-MOT-01–03 |
| `progress` | FR-PRG-01–04 |
| `content` | FR-CNT-01–05 (teacher E5/E4 + Cloudinary, seed in Firestore) |

---

## 5. Authentication design

| Actor | How they authenticate | Where it lives |
|-------|----------------------|----------------|
| Teacher | E-mail + password via **Firebase Authentication** (verification + password reset built in) | Firebase Auth user + Firestore `teachers/{uid}` profile |
| Child | Student number + name matched in **Firestore**; no Firebase e-mail account | Firestore `students` doc; session via custom token from Cloud Functions (recommended) or short-lived app session |

### 5.1 Single home / login page

Child and teacher use **one home page** (one route). There are not two separate login pages.

| Element | Behaviour |
|---------|-----------|
| Default view | **Student login** (student number + name) — primary UI for kids |
| Teacher access | “Teacher login” link/tab on the **same page** shows e-mail + password (Firebase Auth `signInWithEmailAndPassword`) |
| After success | Child → practice home; teacher → class dashboard |
| Register / reset | Teacher links on the same page. Registration calls a Cloud Function that validates the password (length + breached-password check) and creates the user with the Admin SDK; reset uses `sendPasswordResetEmail` |

```text
                    ┌─────────────────────────────┐
                    │  Home page (single route)   │
                    │  default: student login     │
                    │  + teacher login form       │
                    └─────────────┬───────────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              ▼                                       ▼
     Child session                          Teacher session
     (Firestore roster +                    (Firebase Auth
      custom token / session)                + Firestore)
```

```text
Teacher flow:
  home → teacher form → Firebase Auth register/login → verify e-mail
  → create class in Firestore → add students

Child flow:
  home (default) → student number + name → Cloud Function checks Firestore
  → child session → practice (20 min idle timeout)
```

**Rationale:** one classroom URL; Firebase handles teacher credentials; Firestore holds the student roster used by the default form.

---

## 6. Proposed technology stack

Choices below are **design decisions** for implementation under C-4. They are not SRS requirements and may be revised.

| Layer | Proposal | Rationale vs Spec A |
|-------|----------|---------------------|
| Front end | TypeScript + React | Browser/tablet targets (§2.4); WCAG-friendly |
| App hosting | **Firebase Hosting** (EU) | C-2, C-1; same project as Auth/Firestore |
| Authentication | **Firebase Authentication** (e-mail/password) for teachers | FR-ACC-01–02, -07; managed salted hashes (NFR-SEC-02) |
| Database | **Cloud Firestore** (eur3 / EU multi-region) | DR-01–02; classes, students, content, results |
| Server logic | **Cloud Functions** (Node.js) as needed | Child login, TTS proxy, scheduled deletion notices |
| Client offline buffer | `localStorage` / IndexedDB for in-progress answers | NFR-REL-03 |
| i18n | Translation JSON/YAML (EN + FI) | C-3, NFR-MNT-01 |
| Fonts | Lexend, OpenDyslexic, Atkinson Hyperlegible, Arial | FR-SUP-03 |
| Content seed | Firestore seed script / import for baseline exercises | A-4, C-5, FR-CNT-03 |
| Image storage | **Cloudinary** (EU-oriented settings) | FR-CNT-05, A-6 |
| TTS | External provider with EN + FI + word timings | A-1, FR-SUP-01; OI-1 |
| Speech recognition | Optional for FR-EX-09 | Could; OI-2 |
| Observability | First-party logs only; **no** Firebase Analytics | NFR-PRV-03 |
| Security rules | Firestore Security Rules + Auth custom claims (`role`) | NFR-SEC-04 |
| Tests | Unit + Functions tests ≥ 70 % on business logic | NFR-MNT-02 |
| Security test | OWASP Top 10 oriented check before release | NFR-SEC-05 |

**Explicitly rejected for Spec A compliance**

- Firebase Analytics / Google Analytics — NFR-PRV-03.
- Storing read-aloud recordings — DR-03 / FR-EX-09.

---

## 7. Security and privacy architecture

```text
Browser (single home page)
    │ TLS 1.2+
    ▼
Firebase Auth (teachers)  +  Cloud Function (child roster login)
    │
    ▼
Firestore (security rules enforce role scopes)
    │
    ├── Teacher → own classes / students / content
    └── Child   → own profile / results / assigned exercises
```

| Concern | Approach | Spec A |
|---------|----------|--------|
| Transport | HTTPS only, TLS ≥ 1.2 | NFR-SEC-01 |
| Teacher passwords | Firebase Auth stores salted hashes. A sign-up Cloud Function enforces ≥ 10 characters and rejects breached passwords (e.g. Have I Been Pwned range API, which only receives a hash prefix) before creating the account | NFR-SEC-03, -02 |
| Child login | Firestore match + lockout fields; generic errors; optional custom token | FR-ACC-05, NFR-SEC-06 |
| Teacher unlock | Teacher-only Function resets the lockout fields on the student document | FR-ACC-09 |
| Auth data location | Firestore and Functions can be pinned to EU regions, but Firebase Authentication is not region-pinned in the same way, so teacher e-mails may be stored outside the EEA. Must be confirmed against C-1 (AD-9) | C-1 |
| Sessions | Child 20 min; teacher 30 min (client + token expiry) | FR-ACC-06 |
| Authorisation | Firestore rules + `role` claim (`teacher` \| `child`) | NFR-SEC-04 |
| TTS privacy | Text only; no student number/name in payload | NFR-PRV-04 |
| Erasure | Delete Firestore docs + Cloudinary assets; Auth user delete for teachers | FR-ACC-08, DR-04 |
| Portability | Teacher JSON export from Firestore | DR-06 |
| Region | Prefer EU Firebase / Firestore location for C-1 | C-1, DR-02 |

---

## 8. Data architecture (logical)

| Entity | Notes |
|--------|-------|
| Teacher | Firebase Auth uid + Firestore profile; e-mail verification |
| Class | Display name + unique 6-character code; owned by teacher uid |
| Student | Student number, name, birth year, language, current level per type, settings, stars, owned rewards, failed-login count, lock time; enrolled in class (Firestore) |
| PausedExercise | Current item of an unfinished exercise; deleted after 24 hours (FR-EX-08) |
| SharedExercise (seed) | E1, E2, E3, E5; levels 1–10; EN/FI; not editable in UI |
| TeacherText | Custom E5 passage + 3 MCQ; level; language; class-scoped |
| TeacherE4Item | Sentence; level; language; 3 pictures, each with Cloudinary public ID/URL + text label (1 correct, 2 distractors); class-scoped |
| Assignment | Teacher → class or selected students; shared type/level, TeacherText or TeacherE4Item |
| ExerciseResult | Accuracy, duration, level, optional WCPM — no audio blob |
| RewardCatalogue | Predefined cosmetic items (FR-MOT-02) |

---

## 9. Key runtime flows

### 9.1 Teacher sets up a class

1. On the shared home page, teacher opens the teacher form and registers via **Firebase Auth**; verifies e-mail.
2. Teacher creates a class document in **Firestore** → receives class code.
3. Teacher adds each student (name + student number + language + birth year) to Firestore.
4. Students sign in on the same home page (default form); teacher sees roster and progress in Firestore-backed UI.

### 9.2 Teacher creates an E4 item (pictures)

1. Teacher enters a sentence, level and language, selects three images (correct + two distractors), types a label for each, and confirms the pictures show no identifiable people.
2. Client or Cloud Function uploads files to **Cloudinary**.
3. Firestore stores Cloudinary public IDs / secure URLs and labels on the exercise document.
4. Child clients load picture URLs from Cloudinary when playing the exercise; labels are used as `alt` text and as the TTS text when the correct picture is revealed.

### 9.3 Child exercise with TTS

1. Child signs in on the home page with student number + name (Cloud Function + Firestore).
2. Client loads exercise content from Firestore (seed and/or assignments; E4 includes Cloudinary URLs).
3. Client requests TTS (via Function/proxy); adapter strips identifiers.
4. Client plays audio and highlights words (±250 ms, FR-SUP-01).
5. Answers buffered locally; on complete (or reconnect), results written to Firestore (FR-PRG-01, NFR-REL-03).
6. Adaptive engine updates level (FR-EX-06).

### 9.4 Read-aloud mode (Could)

1. Audio streamed to speech adapter; WCPM computed.
2. Audio discarded immediately; only WCPM (and normal result fields) stored.

---

## 10. Deployment and operations

| Topic | Decision aligned with Spec A |
|-------|------------------------------|
| Regions | Firebase project / Firestore in EU; Cloudinary EU-oriented; processors in EEA where possible |
| Availability target | 99.5 % between 07:00–21:00 Finnish time (NFR-REL-01) |
| Backups | Firestore export / scheduled backup; restore drill for RTO 8 h (NFR-REL-02) |
| Environments | Separate Firebase projects or prefixes for `dev` / `staging` / `prod` |
| Content updates | Re-run Firestore seed import for baseline library |
| Config | Firebase + Cloudinary + TTS secrets outside repo (Functions config / Secret Manager) |
| Maintenance | Announced windows outside peak Finnish school hours where possible |

---

## 11. Traceability (architecture ↔ Spec A)

| Architecture element | Spec A references |
|----------------------|-------------------|
| Web client + Firebase backend | §2.1, C-2 |
| Firebase Hosting + Firestore (EU) | C-1, DR-02 |
| Firebase Authentication (teachers) | FR-ACC-01–02, -07; NFR-SEC-02–03 |
| Teacher unlock Function | FR-ACC-09 |
| Firestore as database | DR-01–06 |
| Two-role RBAC (child, teacher) | §2.3, NFR-SEC-04 |
| Class code + manual enrolment | FR-ACC-03–04 |
| Child roster login (Firestore) | FR-ACC-05 |
| Single home page (student default + teacher form) | FR-ACC-00, -01, -05; §3, §5.1 |
| Seeded shared library | A-4, C-5, FR-CNT-03 |
| Cloudinary for E4 images | FR-CNT-05, A-6 |
| TTS / mail / optional STT adapters | §2.1, A-1, A-2, FR-EX-09 |
| i18n files EN/FI | C-3, NFR-MNT-01 |
| Client answer buffer | NFR-REL-03 |
| No product-analytics SDK | NFR-PRV-03 |
| Ephemeral audio path | FR-EX-09, DR-03 |

---

## 12. Open decisions

| ID | Decision | Related |
|----|----------|---------|
| AD-1 | Exact TTS vendor (must support FI + word timings) | OI-1, A-1 |
| AD-2 | Include FR-EX-09 in first release or defer | OI-2, C-4 |
| AD-3 | How much logic lives in the client vs Cloud Functions | C-4, NFR-SEC-04 |
| AD-4 | SPA vs SSR / pre-render for first paint on 5 Mbit/s | NFR-PERF-01 |
| AD-5 | Child session: Firebase custom token vs app-only session cookie | FR-ACC-05, NFR-SEC-06 |
| AD-6 | Student-number uniqueness scope (platform-wide vs per school) | A-5 |
| AD-7 | Cloudinary EU / GDPR settings (folders, signed uploads, delete-on-exercise-remove) | A-6, C-1, FR-CNT-05 |
| AD-8 | Exact Firebase / Firestore EU location and backup export schedule | C-1, NFR-REL-02 |
| AD-9 | Confirm where Firebase Authentication stores teacher e-mails. If outside the EEA is not acceptable under C-1, either get course-staff sign-off or move teacher auth to an EU-hosted option | C-1, DR-02 |

---

## 13. Related documents

- [Software Requirements Specification — Version A](../specification/specification_A.md)
- [Software Requirements Specification — Version B](../specification/specification_B.md) (informal; not the basis of this architecture)
