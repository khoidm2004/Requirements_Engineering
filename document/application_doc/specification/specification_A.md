# ReadBuddy — Software Requirements Specification (Version A)

| Field | Value |
|-------|-------|
| Document | Software Requirements Specification (SRS) |
| Product | ReadBuddy — web application supporting children with reading difficulties |
| Version | A (structured specification) |
| Status | Draft 1.7 |
| Date | 2026-10-31 |
| Structure | Adapted from ISO/IEC/IEEE 29148:2018 |

---

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for **ReadBuddy**, a web-based application that helps children with reading difficulties (including, but not limited to, dyslexia) practise reading in a supportive, accessible environment, and that lets **teachers** follow the child's progress.

The intended readers are the development team, testers, the course staff, and stakeholders who validate the requirements.

### 1.2 Scope

ReadBuddy **shall**:

- provide short, adaptive reading exercises (phonics, syllables, word recognition, sentence and passage reading with comprehension questions);
- provide reading-support tools (text-to-speech with word highlighting, adjustable typography and colours, line focus, syllable colouring);
- record exercise results and present progress to teachers;
- let teachers create class groups, enrol students, assign exercises, add their own reading texts, and upload pictures for sentence–picture (E4) exercises;
- provide a single home page as the application entry point for both children and teachers (FR-ACC-00).

ReadBuddy **shall not**:

- diagnose dyslexia or any other learning difficulty;
- replace therapy by a qualified speech-language therapist or special-education teacher;
- provide chat or any other communication channel between children;
- show advertisements or offer in-app purchases.

### 1.3 Definitions, acronyms and abbreviations

| Term | Definition |
|------|------------|
| Child / Student | End user aged 6–12 who practises reading in the application. |
| Student number | Identifier assigned by the school (or teacher) and used with the student's name to sign in. |
| Teacher | Educator who creates classes, enrols students and monitors progress. |
| Class | A group of students managed by a teacher, identified by a unique class code. |
| Exercise | A single, self-contained reading task (e.g. 10 words to read, one passage with 3 questions). |
| Session | A continuous period of use by a child, from login to logout or timeout. |
| Level | Difficulty step 1–10 of an exercise type; level 1 is easiest. |
| TTS | Text-to-speech: synthetic speech generated from text. |
| WCPM | Words correct per minute, measured in read-aloud exercises. |
| MoSCoW | Prioritisation scheme: Must, Should, Could, Won't (this release). |
| WCAG | Web Content Accessibility Guidelines. |
| GDPR | EU General Data Protection Regulation (2016/679). |

### 1.4 References

1. ISO/IEC/IEEE 29148:2018 — Systems and software engineering — Life cycle processes — Requirements engineering.
2. W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*, 2023.
3. Regulation (EU) 2016/679 (GDPR).
4. British Dyslexia Association, *Dyslexia Style Guide*, 2023.

### 1.5 Document overview

Section 2 describes the product context, users and constraints. Section 3 lists functional requirements, Section 4 non-functional requirements, Section 5 data requirements. Section 6 gives traceability from stakeholder goals to requirements, and Section 7 lists open issues.

---

## 2. Overall description

### 2.1 Product perspective

ReadBuddy is a new, stand-alone web application accessed through a web browser on desktop computers, laptops and tablets. It consists of a browser client and back-end services (hosted application platform, data store, and serverless functions as needed). It uses an external TTS service, an external image-hosting service for teacher picture uploads, and e-mail delivery (including provider-built-in auth mail where applicable). It has no integration with school information systems in this release.

### 2.2 Stakeholders and goals

| ID | Stakeholder | Goal |
|----|-------------|------|
| SG-1 | Child | Practise reading in short sessions without feeling frustrated or judged. |
| SG-2 | Teacher | Give children targeted practice and monitor a whole class with little extra work. |
| SG-3 | Data protection officer | Ensure children's personal data is processed lawfully and minimally. |

### 2.3 User classes and characteristics

| User class | Characteristics | Frequency of use |
|------------|-----------------|------------------|
| Child | Age 6–12. Reading skill below age expectation. May need help reading the login form the first time. Short attention span (target session length 10–15 min). Uses mouse, keyboard or touch screen. | Daily or several times per week |
| Teacher | Adult, basic IT skill. Manages up to 35 children per class and up to 10 classes. Creates classes and enrols students. | Several times per week |

### 2.4 Operating environment

- Desktop browsers: the two most recent major versions of Chrome, Firefox, Safari and Edge at the time of release.
- Tablets: iPadOS Safari and Android Chrome (two most recent major versions), screen size ≥ 9 inches.
- Minimum viewport: 768 × 600 CSS pixels. Phones are not a supported target in this release.
- Network: functioning at 5 Mbit/s download bandwidth.

### 2.5 Design and implementation constraints

- C-1: All personal data shall be stored and processed within the European Economic Area.
- C-2: The application shall be delivered as a web application; no installation on the user's device shall be required.
- C-3: The user interface shall be available in English and Finnish at release.
- C-4: The project budget allows a single development team of 5 students over 12 weeks; requirements marked *Could* may be postponed.
- C-5: The shared content library is pre-seeded at deploy time (A-4) and is not edited through the application UI.

### 2.6 Assumptions and dependencies

- A-1: A TTS service supporting English and Finnish with word-level timing information is available.
- A-2: Teachers have an e-mail address.
- A-3: Schools provide devices with audio output (speakers or headphones) for children using the app at school.
- A-4: Baseline exercise content for levels 1–10 (word lists, passages, questions, and audio assets where needed) is supplied as seed data before release; updates to that baseline are done by redeploying seed content.
- A-5: Each enrolled student has a student number that is unique within the platform (or unique within the school, if schools are modelled later).
- A-6: An external image-hosting service is available for teacher-uploaded E4 pictures (see architecture for the chosen provider).

---

## 3. Functional requirements

Each requirement has an ID, a priority (MoSCoW), a source (stakeholder goal) and acceptance criteria.

### 3.1 Accounts and authentication (ACC)

**FR-ACC-00 — Single home page**
The system shall provide one home page (one primary entry URL/route) used by both children and teachers. The default view shall be the child login form (student number + name). The same page shall expose a control (e.g. link or tab) that reveals the teacher login form (e-mail + password). After successful authentication, the system shall navigate by role: child → practice home; teacher → class dashboard. Teacher registration and password-reset entry points may appear on this page or as short linked routes from it.
- Priority: Must · Source: SG-1, SG-2
- Acceptance: A classroom device opens a single URL; a child can sign in without opening a separate teacher page; a teacher can switch to the teacher form without changing site origin/path to a different login app.
- Rationale: One entry point reduces deployment and classroom setup work while keeping distinct authentication methods per role (FR-ACC-01, FR-ACC-05).

**FR-ACC-01 — Teacher registration**
The system shall allow a teacher to register an account with an e-mail address and a password.
- Priority: Must · Source: SG-2
- Acceptance: Given a valid, unused e-mail address and a password that meets NFR-SEC-03, when the teacher submits the registration form, then an account is created in "unverified" state and a verification e-mail is sent within 2 minutes.

**FR-ACC-02 — Teacher e-mail verification**
The system shall require a teacher to verify the e-mail address before creating classes or enrolling students.
- Priority: Must · Source: SG-3
- Acceptance: The verification link is valid for 24 hours; an unverified teacher who opens "Create class" is prompted to verify e-mail first.

**FR-ACC-03 — Class creation**
The system shall allow a verified teacher to create a class (group) with a display name; the system shall assign a unique 6-character class code.
- Priority: Must · Source: SG-2
- Acceptance: After creation, the teacher sees the class code; no two active classes share the same code.

**FR-ACC-04 — Enrol student in class**
The system shall allow a teacher to add a student to one of their classes by entering **student name**, **student number**, preferred language (English or Finnish), and birth year.
- Priority: Must · Source: SG-2
- Acceptance: The student appears in the class roster; a duplicate student number is rejected with a clear error.

**FR-ACC-05 — Child login**
The system shall let a child sign in by entering their **student number** and **name** (matching the enrolled record, case-insensitive on the name).
- Priority: Must · Source: SG-1
- Rationale: School roster login without a separate password for children.
- Acceptance: A correct student number + name opens the child's home screen; an incorrect pair shows a generic error (no indication which field failed); after 5 consecutive failed attempts for the same student number the login for that student is locked for 5 minutes and the teacher can unlock it.

**FR-ACC-06 — Session timeout**
The system shall log out a child after 20 minutes without interaction and a teacher after 30 minutes without interaction.
- Priority: Must · Source: SG-3

**FR-ACC-07 — Teacher password reset**
The system shall allow teachers to reset their password through a single-use link sent to their verified e-mail address, valid for 1 hour.
- Priority: Must · Source: SG-2

**FR-ACC-08 — Remove student**
The system shall allow a teacher to remove a student from their class and to delete that student's personal data from the application. All personal data of a deleted student shall be permanently removed within 30 days (see DR-04).
- Priority: Must · Source: SG-3

**FR-ACC-09 — Unlock student login**
The system shall show the teacher which students in their classes are currently locked out (FR-ACC-05) and shall let the teacher unlock a student immediately.
- Priority: Must · Source: SG-2
- Acceptance: A locked student is marked in the class roster (FR-PRG-03); after the teacher selects "Unlock", the student can sign in at once and the failed-attempt counter is reset to 0.

### 3.2 Reading exercises (EX)

**FR-EX-01 — Exercise types**
The system shall provide the following exercise types. E1, E2, E3 and E5 shall be available in levels 1–10 in English and Finnish from the shared content library (FR-CNT-03). E4 shall be available at the levels and languages for which a teacher has created E4 items (FR-CNT-05); if no E4 item exists at a child's current level and language, E4 is not offered to that child.

| Code | Exercise type | Description |
|------|---------------|-------------|
| E1 | Letter–sound | Child hears a sound and selects the matching letter or letter group from 3–6 options. |
| E2 | Syllables | Child splits a displayed word into syllables by tapping between letters. |
| E3 | Word recognition | Child hears a word and selects the matching written word from 4 similar-looking options. |
| E4 | Sentence reading | Child reads a sentence and selects the picture that matches it from 3 options. Pictures are provided when a teacher creates the exercise (FR-CNT-05). |
| E5 | Passage reading | Child reads a passage of 40–250 words and answers 3 multiple-choice comprehension questions (text only; no pictures required). |

- Priority: Must (E1, E3, E5), Should (E2, E4) · Source: SG-1, SG-2

**FR-EX-02 — Audio instructions**
The system shall play a spoken instruction automatically at the start of every exercise and shall provide a "repeat instruction" button with a speaker icon on every exercise screen.
- Priority: Must · Source: SG-1
- Acceptance: Every exercise type can be completed by a test user who cannot read the written instructions.

**FR-EX-03 — Exercise length**
Each exercise shall contain between 5 and 10 items (E1–E4) or exactly one passage (E5), so that it can be completed in 2–5 minutes by a child at the matching level.
- Priority: Must · Source: SG-1

**FR-EX-04 — Immediate feedback**
The system shall give feedback after each answer: a correct answer shows a positive animation and sound; an incorrect answer highlights the correct option and plays it aloud. Feedback shall not use the colour red or the words "wrong" or "fail".
- Priority: Must · Source: SG-1

**FR-EX-05 — Second attempt**
The system shall allow one additional attempt for an item answered incorrectly before revealing the correct answer.
- Priority: Should · Source: SG-1

**FR-EX-06 — Adaptive difficulty**
The system shall adjust the level of each exercise type per child as follows:
- if accuracy is ≥ 85 % in 3 consecutive exercises of that type, the level is increased by 1;
- if accuracy is < 50 % in 2 consecutive exercises of that type, the level is decreased by 1;
- the level never goes below 1 or above 10.
- Priority: Must · Source: SG-1, SG-2
- Acceptance: Unit tests cover all three rules and both boundaries.

**FR-EX-07 — Initial placement**
The system shall start every new child at a level derived from the child's age (age 6–7 → level 1, 8–9 → level 3, 10–12 → level 5), which the teacher may override.
- Priority: Should · Source: SG-2

**FR-EX-08 — Pause and resume**
The system shall allow a child to leave an exercise at any time and resume it from the same item within 24 hours.
- Priority: Should · Source: SG-1

**FR-EX-09 — Read-aloud practice**
The system shall offer an optional read-aloud mode for E4 and E5 in which the child's speech is recorded through the microphone and compared against the text using speech recognition, and the WCPM value is calculated.
- Priority: Could · Source: SG-2
- Constraints: Audio recordings shall be processed and then deleted immediately; they shall not be stored (see DR-03).

**FR-EX-10 — Daily practice suggestion**
The system shall present each child with a "Today's practice" set of 3 exercises, chosen from the types where the child's accuracy is lowest and from any exercises assigned by the teacher.
- Priority: Should · Source: SG-1, SG-2

### 3.3 Reading-support tools (SUP)

**FR-SUP-01 — Text-to-speech**
The system shall read aloud any reading text, question or instruction when the child selects the speaker icon next to it, and shall highlight each word as it is spoken.
- Priority: Must · Source: SG-1
- Acceptance: Highlight is synchronised with audio within ±250 ms per word.

**FR-SUP-02 — Speech rate**
The system shall allow the TTS speed to be set to 0.6×, 0.8×, 1.0× (default) or 1.2×.
- Priority: Should · Source: SG-1

**FR-SUP-03 — Typography settings**
The system shall allow per-child settings for:
- font: Lexend (default), OpenDyslexic, Atkinson Hyperlegible, or Arial;
- font size: 18, 22 (default), 26 or 32 CSS pixels;
- line spacing: 1.5 (default), 2.0 or 2.5;
- letter spacing: normal (default) or wide (+0.12 em).
- Priority: Must · Source: SG-1
- Acceptance: Changes take effect on all reading texts immediately without reloading the page and persist between sessions and devices.

**FR-SUP-04 — Background colour**
The system shall allow per-child selection of the reading background from cream (default), light yellow, light blue, light green, or white, with text colour dark grey (#222222).
- Priority: Must · Source: SG-1

**FR-SUP-05 — Line focus**
The system shall provide a line-focus mode that dims all text lines except the current one; the child moves the focus with arrow keys, swipe, or on-screen buttons.
- Priority: Should · Source: SG-1

**FR-SUP-06 — Syllable colouring**
The system shall provide an optional mode that displays the syllables of each word in two alternating colours.
- Priority: Could · Source: SG-1

**FR-SUP-07 — Word help**
The system shall allow the child to tap or click any word in a reading text to hear it spoken, split into syllables and as a whole.
- Priority: Should · Source: SG-1

### 3.4 Motivation (MOT)

**FR-MOT-01 — Stars**
The system shall award 1–3 stars for each completed exercise based on accuracy (≥ 50 %: 1 star, ≥ 70 %: 2 stars, ≥ 90 %: 3 stars) and shall award 1 star for completing an exercise with lower accuracy.
- Priority: Should · Source: SG-1
- Rationale: Every completed exercise is rewarded to sustain motivation.

**FR-MOT-02 — Rewards**
The system shall let the child spend stars on cosmetic items (avatar clothes, stickers) from a predefined catalogue.
- Priority: Could · Source: SG-1

**FR-MOT-03 — No comparison between children**
The system shall not display leaderboards, rankings or any other children's results to a child.
- Priority: Must · Source: SG-1

### 3.5 Progress tracking and reporting (PRG)

**FR-PRG-01 — Result recording**
The system shall record, for each completed exercise: child ID, exercise type, level, number of items, number of correct items, duration, date and time, and WCPM (if read-aloud mode was used).
- Priority: Must · Source: SG-2

**FR-PRG-02 — Teacher child detail**
The system shall show a teacher, per child in their class: total practice time per week, number of exercises completed per week, current level per exercise type, and accuracy trend per exercise type over the last 12 weeks as a line chart.
- Priority: Must · Source: SG-2

**FR-PRG-03 — Teacher class overview**
The system shall show a teacher a table of all children in a class with columns: name, student number, practice time in the last 7 days, exercises in the last 7 days, current level per exercise type, an indicator for children who have not practised in 7 days, and an indicator for children whose login is locked (FR-ACC-09).
- Priority: Must · Source: SG-2
- Acceptance: The table is sortable by every column and loads within the time stated in NFR-PERF-01 for a class of 35 children.

**FR-PRG-04 — Export**
The system shall allow a teacher to export the class overview (FR-PRG-03) as a CSV file.
- Priority: Could · Source: SG-2

### 3.6 Content and assignments (CNT)

**FR-CNT-01 — Assignments**
The system shall allow a teacher to assign one or more exercises (type and level, a specific teacher text (FR-CNT-02), or a specific teacher E4 item (FR-CNT-05)) to a whole class or to selected children, with an optional due date.
- Priority: Should · Source: SG-2
- Acceptance: Assigned exercises appear in the child's "Today's practice" (FR-EX-10) from the next login.

**FR-CNT-02 — Teacher texts (E5)**
The system shall allow a teacher to add a reading passage of 40–250 words with 3 multiple-choice **text** questions, and to set its level (1–10) and language (English or Finnish). The passage becomes available as an E5 exercise at that level and language for that teacher's classes only.
- Priority: Should · Source: SG-2
- Acceptance: The level and language fields are required; the saved text is offered to children of the teacher's classes whose current E5 level and language match, and can be assigned directly (FR-CNT-01).

**FR-CNT-03 — Shared content library**
The system shall offer children exercises from a shared content library that is pre-seeded at deployment (A-4, C-5) and covers E1, E2, E3 and E5 in levels 1–10 in English and Finnish. E4 is not part of the shared library (see FR-CNT-05). Teachers shall not create, edit or deactivate shared-library items through the UI.
- Priority: Must · Source: SG-2

**FR-CNT-04 — Content review**
The system shall prevent a teacher-created exercise (E4 or E5) from being shown to children until the teacher has previewed it with TTS at least once.
- Priority: Could · Source: SG-2

**FR-CNT-05 — Teacher sentence–picture items (E4)**
The system shall allow a teacher to create an E4 exercise for their classes by entering a sentence, setting its level (1–10) and language (English or Finnish), and uploading **three** pictures (one correct match and two distractors). For each picture the teacher shall enter a short text label (1–5 words, e.g. "a red ball"); the label is used as the picture's text alternative and is the text read aloud when the correct picture is revealed (FR-EX-04). Uploaded pictures shall be stored via the external image-hosting service (A-6); the application shall persist only the image references (e.g. URL or public ID) and labels, not raw image binaries in the primary database.
- Priority: Should · Source: SG-2
- Acceptance: The sentence, level, language, three pictures and three labels are all required. After save, the exercise appears for assignment (FR-CNT-01); the child sees the sentence and three pictures; selecting the correct picture counts as a correct answer; screen readers announce each picture by its label. Rejected uploads (wrong type or over size limit) show a clear error and do not create a partial exercise.
- Constraints: Allowed formats JPEG/PNG/WebP; maximum file size 2 MB per image. Pictures shall not show identifiable people (including students); before upload the teacher shall confirm this with a checkbox, and the upload form shall state the rule.

---

## 4. Non-functional requirements

### 4.1 Usability (US)

- **NFR-US-01** — A child shall be able to sign in with student number and name and complete a level-1 E1 exercise; login fields shall have audio labels. *Verification:* usability test with ≥ 5 children aged 6–7 (teacher may assist with typing once); ≥ 4 of 5 complete the exercise.
- **NFR-US-02** — A first-time verified teacher shall be able to create a class, enrol one student and open that student's progress view within 15 minutes. *Verification:* usability test with ≥ 5 teachers; median time ≤ 15 min.
- **NFR-US-03** — Every interactive element used by children shall have a touch/click target of at least 48 × 48 CSS pixels.
- **NFR-US-04** — Child-facing screens shall contain at most 3 primary actions and shall use icons with audio labels in addition to text.
- **NFR-US-05** — The application shall not use timed tasks for children except in read-aloud mode (FR-EX-09), where timing is not shown to the child.

### 4.2 Accessibility (ACS)

- **NFR-ACS-01** — All screens shall conform to WCAG 2.2 level AA. *Verification:* automated audit (axe) with zero violations plus manual review of keyboard navigation and screen-reader labels.
- **NFR-ACS-02** — All functions shall be operable with keyboard only.
- **NFR-ACS-03** — Reading texts shall follow the British Dyslexia Association style guide: left-aligned, no justified text, no italics or underlining for emphasis, line length ≤ 70 characters.

### 4.3 Performance (PERF)

- **NFR-PERF-01** — 95 % of page loads shall complete (Largest Contentful Paint) within 2.5 s on a 5 Mbit/s connection.
- **NFR-PERF-02** — TTS audio shall start playing within 1 s of the child selecting the speaker icon, for 95 % of requests.
- **NFR-PERF-03** — Feedback after an answer (FR-EX-04) shall appear within 300 ms.
- **NFR-PERF-04** — The system shall support 2,000 concurrently active users while meeting NFR-PERF-01 to -03.

### 4.4 Reliability and availability (REL)

- **NFR-REL-01** — The service shall be available 99.5 % of the time between 07:00 and 21:00 Finnish time, measured monthly, excluding announced maintenance.
- **NFR-REL-02** — Completed exercise results shall not be lost: the recovery point objective is 24 hours (daily backups) and recovery time objective is 8 hours.
- **NFR-REL-03** — If the network connection is lost during an exercise, the current answers shall be kept in the browser and sent when the connection returns.

### 4.5 Security (SEC)

- **NFR-SEC-01** — All communication shall use HTTPS with TLS 1.2 or higher.
- **NFR-SEC-02** — Teacher passwords shall be stored only as salted hashes by the authentication service (e.g. Argon2id, bcrypt, or the equivalent salted-hash scheme of a managed auth provider such as Firebase Authentication). Plaintext passwords shall never be stored.
- **NFR-SEC-03** — Teacher passwords shall be at least 10 characters and shall not appear in a list of known breached passwords.
- **NFR-SEC-04** — Access control shall be role-based: a teacher sees only students in their classes; a child sees only their own data.
- **NFR-SEC-05** — The application shall have no high or critical findings in an OWASP Top 10 based security test before release.
- **NFR-SEC-06** — Child login (student number + name) is a low-assurance school roster check; the system shall not expose whether a student number exists independently of the name match (see FR-ACC-05).

### 4.6 Privacy (PRV)

- **NFR-PRV-01** — The system shall process personal data in compliance with GDPR; a privacy notice in plain language, with a child-friendly audio version, shall be available from every page.
- **NFR-PRV-02** — The system shall collect only the data listed in Section 5.
- **NFR-PRV-03** — No third-party analytics, advertising or tracking cookies shall be used.
- **NFR-PRV-04** — Text sent to the TTS service shall not contain child identifiers (including student number).

### 4.7 Maintainability and portability (MNT)

- **NFR-MNT-01** — All UI text shall be stored in translation files so that a new language can be added without code changes.
- **NFR-MNT-02** — Server-side business logic shall have at least 70 % automated test statement coverage.
- **NFR-MNT-03** — The application shall run in the environments listed in Section 2.4.

---

## 5. Data requirements

| ID | Requirement |
|----|-------------|
| DR-01 | The system shall store the following personal data only: teacher e-mail, password hash, teacher name; child student number, name, birth year, language, current level per exercise type, settings (FR-SUP-02 to -06), results (FR-PRG-01), stars and owned reward items (FR-MOT-01, -02), failed-login count and lock time (FR-ACC-05, -09), paused-exercise progress for up to 24 hours (FR-EX-08), and assignments addressed to the child (FR-CNT-01). Teacher exercise content (texts, E4 sentences, picture labels and image references for FR-CNT-02, -05) may be stored; it contains no personal data, and image binaries are held by the external image host (A-6). |
| DR-02 | All personal data shall be stored in data centres located in the EEA (C-1), encrypted at rest. |
| DR-03 | Audio recorded in read-aloud mode shall not be stored after the WCPM value is calculated. |
| DR-04 | Data of deleted students or teacher accounts shall be removed from the live database immediately and from backups within 30 days. |
| DR-05 | Child data with no login for 24 months shall be deleted after the responsible teacher has been notified by e-mail 30 days in advance. |
| DR-06 | A teacher shall be able to download stored data for students in their classes in JSON format (GDPR Art. 20 support via the school/teacher as contact point). |

---

## 6. Traceability

| Stakeholder goal | Requirements |
|------------------|--------------|
| SG-1 Child | FR-ACC-00, -05–06, FR-EX-01–10, FR-SUP-01–07, FR-MOT-01–03, NFR-US-01, -03, -04, -05, NFR-ACS-01–03, NFR-PERF-01–04 |
| SG-2 Teacher | FR-ACC-00–01, -03–04, -07–09, FR-EX-01, -06, -07, -09, -10, FR-PRG-01–04, FR-CNT-01–05, NFR-US-02, NFR-PERF-01, -04, NFR-REL-01–03, NFR-MNT-01–03 |
| SG-3 Data protection | FR-ACC-02, -06, -08, NFR-SEC-01–06, NFR-PRV-01–04, DR-01–06 |

---

## 7. Open issues

| ID | Issue | Owner |
|----|-------|-------|
| OI-1 | Confirm the TTS provider supports Finnish with word-level timing (A-1). | Team |
| OI-2 | Decide whether read-aloud mode (FR-EX-09) is in this release given the budget (C-4). | Team + course staff |
