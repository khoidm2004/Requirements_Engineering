# ReadBuddy — Software Requirements Specification (Version A)

| Field | Value |
|-------|-------|
| Document | Software Requirements Specification (SRS) |
| Product | ReadBuddy — web application supporting children with reading difficulties |
| Version | A (complete specification) |
| Status | Draft 1.0 |
| Date | 2026-10-30 |
| Structure | Adapted from ISO/IEC/IEEE 29148:2018 |

---

## 1. Introduction

### 1.1 Purpose

This document specifies the requirements for **ReadBuddy**, a web-based application that helps children with reading difficulties (including, but not limited to, dyslexia) practise reading in a supportive, accessible environment, and that lets parents and teachers follow the child's progress.

The intended readers are the development team, testers, the course staff, and stakeholders who validate the requirements.

### 1.2 Scope

ReadBuddy **shall**:

- provide short, adaptive reading exercises (phonics, syllables, word recognition, sentence and passage reading with comprehension questions);
- provide reading-support tools (text-to-speech with word highlighting, adjustable typography and colours, line focus, syllable colouring);
- record exercise results and present progress to parents and teachers;
- let teachers assign exercises and add their own reading texts.

ReadBuddy **shall not**:

- diagnose dyslexia or any other learning difficulty;
- replace therapy by a qualified speech-language therapist or special-education teacher;
- provide chat or any other communication channel between children;
- show advertisements or offer in-app purchases.

### 1.3 Definitions, acronyms and abbreviations

| Term | Definition |
|------|------------|
| Child | End user aged 6–12 who practises reading in the application. |
| Guardian | Parent or legal guardian who owns the account of one or more children. |
| Teacher | Educator who manages one or more classes of children. |
| Administrator | Operator staff member who manages the platform and its content library. |
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
3. Regulation (EU) 2016/679 (GDPR), in particular Art. 8 (conditions applicable to child's consent).
4. British Dyslexia Association, *Dyslexia Style Guide*, 2023.

### 1.5 Document overview

Section 2 describes the product context, users and constraints. Section 3 lists functional requirements, Section 4 non-functional requirements, Section 5 data requirements. Section 6 gives traceability from stakeholder goals to requirements.

---

## 2. Overall description

### 2.1 Product perspective

ReadBuddy is a new, stand-alone web application accessed through a web browser on desktop computers, laptops and tablets. It consists of a browser client and a server back end. It uses an external TTS service and an external e-mail delivery service through their public APIs. It has no integration with school information systems in this release.

### 2.2 Stakeholders and goals

| ID | Stakeholder | Goal |
|----|-------------|------|
| SG-1 | Child | Practise reading in short sessions without feeling frustrated or judged. |
| SG-2 | Guardian | Support the child's practice at home and see whether the child is improving. |
| SG-3 | Teacher | Give children targeted practice and monitor a whole class with little extra work. |
| SG-4 | Administrator | Operate the service reliably and keep the content library up to date. |
| SG-5 | Data protection officer | Ensure children's personal data is processed lawfully and minimally. |

### 2.3 User classes and characteristics

| User class | Characteristics | Frequency of use |
|------------|-----------------|------------------|
| Child | Age 6–12. Reading skill below age expectation. May not be able to read instructions. Short attention span (target session length 10–15 min). Uses mouse, keyboard or touch screen. | Daily or several times per week |
| Guardian | Adult, any level of IT skill. Uses the app mainly to set up the child and read progress reports. | Weekly |
| Teacher | Adult, basic IT skill. Manages up to 35 children per class and up to 10 classes. | Several times per week |
| Administrator | Technical staff. | As needed |

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

### 2.6 Assumptions and dependencies

- A-1: A TTS service supporting English and Finnish with word-level timing information is available.
- A-2: Guardians have an e-mail address.
- A-3: Schools provide devices with audio output (speakers or headphones) for children using the app at school.
- A-4: Exercise content (word lists, passages, questions) for levels 1–10 is supplied by the content team before development of FR-EX requirements starts.

---

## 3. Functional requirements

Each requirement has an ID, a priority (MoSCoW), a source (stakeholder goal) and acceptance criteria.

### 3.1 Accounts and authentication (ACC)

**FR-ACC-01 — Guardian registration**
The system shall allow a guardian to register an account with an e-mail address and a password.
- Priority: Must · Source: SG-2
- Acceptance: Given a valid, unused e-mail address and a password that meets NFR-SEC-03, when the guardian submits the registration form, then an account is created in "unverified" state and a verification e-mail is sent within 2 minutes.

**FR-ACC-02 — E-mail verification**
The system shall require a guardian to verify the e-mail address before child profiles can be created.
- Priority: Must · Source: SG-5
- Acceptance: An unverified guardian who opens "Add child" sees a message asking them to verify their e-mail; the verification link is valid for 24 hours.

**FR-ACC-03 — Parental consent**
The system shall record explicit parental consent, with a timestamp and the version of the privacy notice, before a child profile is created.
- Priority: Must · Source: SG-5
- Acceptance: A child profile cannot be saved unless the consent checkbox is ticked; the consent record is visible in the guardian's account settings.

**FR-ACC-04 — Child profile**
The system shall allow a guardian to create up to 6 child profiles, each with a first name or nickname, a birth year, a preferred language (English or Finnish) and an avatar chosen from a predefined set.
- Priority: Must · Source: SG-2
- Acceptance: The profile form contains exactly these fields; a 7th profile cannot be created; no surname, photo or full birth date is requested.

**FR-ACC-05 — Teacher registration**
The system shall allow a teacher to register with an e-mail address and a password, and an administrator to approve the teacher account before it can create classes.
- Priority: Must · Source: SG-3, SG-4

**FR-ACC-06 — Class management**
The system shall allow an approved teacher to create a class, which generates a unique 6-character class code.
- Priority: Must · Source: SG-3

**FR-ACC-07 — Linking a child to a class**
The system shall allow a guardian to link a child profile to a class by entering the class code. The teacher shall see the child in the class only after the guardian has confirmed the link.
- Priority: Must · Source: SG-3, SG-5
- Acceptance: After the guardian enters a valid code and confirms, the child appears in the teacher's class list within 1 minute. An invalid code shows "Class code not found" and links nothing.

**FR-ACC-08 — Child login**
The system shall let a child log in by selecting their avatar on the family or class login screen and entering a picture password consisting of a sequence of 3 pictures chosen from 9.
- Priority: Must · Source: SG-1
- Rationale: Children with reading difficulties cannot reliably type text passwords.
- Acceptance: A child can complete login without reading any text; after 5 consecutive failed attempts the child profile is locked for 5 minutes and the guardian (or teacher) can reset the picture password.

**FR-ACC-09 — Session timeout**
The system shall log out a child after 20 minutes without interaction and an adult user after 30 minutes without interaction.
- Priority: Must · Source: SG-5

**FR-ACC-10 — Password reset**
The system shall allow guardians and teachers to reset their password through a single-use link sent to their verified e-mail address, valid for 1 hour.
- Priority: Must · Source: SG-2, SG-3

**FR-ACC-11 — Account deletion**
The system shall allow a guardian to delete a child profile or the whole guardian account. All personal data of the deleted profile(s) shall be permanently removed within 30 days (see DR-04).
- Priority: Must · Source: SG-5

### 3.2 Reading exercises (EX)

**FR-EX-01 — Exercise types**
The system shall provide the following exercise types, each in levels 1–10, in English and Finnish:

| Code | Exercise type | Description |
|------|---------------|-------------|
| E1 | Letter–sound | Child hears a sound and selects the matching letter or letter group from 3–6 options. |
| E2 | Syllables | Child splits a displayed word into syllables by tapping between letters. |
| E3 | Word recognition | Child hears a word and selects the matching written word from 4 similar-looking options. |
| E4 | Sentence reading | Child reads a sentence and selects the picture that matches it from 3 options. |
| E5 | Passage reading | Child reads a passage of 40–250 words and answers 3 multiple-choice comprehension questions. |

- Priority: Must (E1, E3, E5), Should (E2, E4) · Source: SG-1, SG-3

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
- Priority: Must · Source: SG-1, SG-3
- Acceptance: Unit tests cover all three rules and both boundaries.

**FR-EX-07 — Initial placement**
The system shall start every new child at a level derived from the child's age (age 6–7 → level 1, 8–9 → level 3, 10–12 → level 5), which the guardian or teacher may override.
- Priority: Should · Source: SG-2, SG-3

**FR-EX-08 — Pause and resume**
The system shall allow a child to leave an exercise at any time and resume it from the same item within 24 hours.
- Priority: Should · Source: SG-1

**FR-EX-09 — Read-aloud practice**
The system shall offer an optional read-aloud mode for E4 and E5 in which the child's speech is recorded through the microphone and compared against the text using speech recognition, and the WCPM value is calculated.
- Priority: Could · Source: SG-2, SG-3
- Constraints: The mode is available only if the guardian has given a separate consent for audio processing. Audio recordings shall be processed and then deleted immediately; they shall not be stored (see DR-03).

**FR-EX-10 — Daily practice suggestion**
The system shall present each child with a "Today's practice" set of 3 exercises, chosen from the types where the child's accuracy is lowest and from any exercises assigned by the teacher.
- Priority: Should · Source: SG-1, SG-3

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
- Priority: Must · Source: SG-2, SG-3

**FR-PRG-02 — Guardian dashboard**
The system shall show a guardian, per child: total practice time per week, number of exercises completed per week, current level per exercise type, and accuracy trend per exercise type over the last 12 weeks as a line chart.
- Priority: Must · Source: SG-2

**FR-PRG-03 — Teacher class overview**
The system shall show a teacher a table of all children in a class with columns: name, practice time in the last 7 days, exercises in the last 7 days, current level per exercise type, and an indicator for children who have not practised in 7 days.
- Priority: Must · Source: SG-3
- Acceptance: The table is sortable by every column and loads within the time stated in NFR-PERF-01 for a class of 35 children.

**FR-PRG-04 — Teacher child detail**
The system shall allow a teacher to open the same per-child view as the guardian (FR-PRG-02) for any child in their class.
- Priority: Should · Source: SG-3

**FR-PRG-05 — Weekly e-mail summary**
The system shall send each guardian an optional weekly e-mail every Sunday at 18:00 local time summarising each child's practice time, exercises completed and level changes. Guardians can switch it on or off; it is off by default.
- Priority: Could · Source: SG-2

**FR-PRG-06 — Export**
The system shall allow a teacher to export the class overview (FR-PRG-03) as a CSV file.
- Priority: Could · Source: SG-3

### 3.6 Content and assignments (CNT)

**FR-CNT-01 — Assignments**
The system shall allow a teacher to assign one or more exercises (type and level, or a specific teacher text) to a whole class or to selected children, with an optional due date.
- Priority: Should · Source: SG-3
- Acceptance: Assigned exercises appear in the child's "Today's practice" (FR-EX-10) from the next login.

**FR-CNT-02 — Teacher texts**
The system shall allow a teacher to add a reading passage of 40–250 words with 3 multiple-choice questions, which becomes available as an E5 exercise for that teacher's classes only.
- Priority: Should · Source: SG-3

**FR-CNT-03 — Content library management**
The system shall allow an administrator to create, edit, deactivate and preview exercises in the shared content library. Deactivated exercises are no longer offered to children; recorded results are kept.
- Priority: Must · Source: SG-4

**FR-CNT-04 — Content review**
The system shall prevent a teacher text from being shown to children until the teacher has previewed it with TTS at least once.
- Priority: Could · Source: SG-3

### 3.7 Administration (ADM)

**FR-ADM-01 — Teacher approval**
The system shall provide administrators a list of pending teacher accounts with approve and reject actions.
- Priority: Must · Source: SG-4

**FR-ADM-02 — Audit log**
The system shall log every administrator action and every access by a teacher or administrator to a child's data, with user ID, action and timestamp, and keep the log for 12 months.
- Priority: Must · Source: SG-5

---

## 4. Non-functional requirements

### 4.1 Usability (US)

- **NFR-US-01** — A child aged 6 who cannot read shall be able to log in and complete a level-1 E1 exercise without adult help. *Verification:* usability test with ≥ 5 children aged 6–7; ≥ 4 of 5 succeed.
- **NFR-US-02** — A first-time guardian shall be able to register, create a child profile and start the child's first exercise within 10 minutes. *Verification:* usability test with ≥ 5 guardians; median time ≤ 10 min.
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
- **NFR-SEC-02** — Passwords and picture passwords shall be stored only as salted hashes using Argon2id or bcrypt.
- **NFR-SEC-03** — Adult passwords shall be at least 10 characters and shall not appear in a list of known breached passwords.
- **NFR-SEC-04** — Access control shall be role-based: a guardian sees only their own children; a teacher sees only children linked to their classes; a child sees only their own data.
- **NFR-SEC-05** — The application shall have no high or critical findings in an OWASP Top 10 based security test before release.

### 4.6 Privacy (PRV)

- **NFR-PRV-01** — The system shall process personal data in compliance with GDPR; a privacy notice in plain language, with a child-friendly audio version, shall be available from every page.
- **NFR-PRV-02** — The system shall collect only the data listed in Section 5.
- **NFR-PRV-03** — No third-party analytics, advertising or tracking cookies shall be used.
- **NFR-PRV-04** — Text sent to the TTS service shall not contain child identifiers.

### 4.7 Maintainability and portability (MNT)

- **NFR-MNT-01** — All UI text shall be stored in translation files so that a new language can be added without code changes.
- **NFR-MNT-02** — Server-side business logic shall have at least 70 % automated test statement coverage.
- **NFR-MNT-03** — The application shall run in the environments listed in Section 2.4.

---

## 5. Data requirements

| ID | Requirement |
|----|-------------|
| DR-01 | The system shall store the following personal data only: guardian and teacher e-mail, password hash, name of teacher; child nickname, birth year, language, avatar, picture-password hash, settings (FR-SUP-02 to -06), results (FR-PRG-01), consent records (FR-ACC-03, FR-EX-09). |
| DR-02 | All personal data shall be stored in data centres located in the EEA (C-1), encrypted at rest. |
| DR-03 | Audio recorded in read-aloud mode shall not be stored after the WCPM value is calculated. |
| DR-04 | Data of deleted accounts shall be removed from the live database immediately and from backups within 30 days. |
| DR-05 | Child data of accounts with no login for 24 months shall be deleted after the guardian has been notified by e-mail 30 days in advance. |
| DR-06 | A guardian shall be able to download all stored data of their children in JSON format (GDPR Art. 20). |

---

## 6. Traceability

| Stakeholder goal | Requirements |
|------------------|--------------|
| SG-1 Child | FR-ACC-08, FR-EX-01–10, FR-SUP-01–07, FR-MOT-01–03, NFR-US-01, -03, -04, -05, NFR-ACS-01–03, NFR-PERF-02, -03 |
| SG-2 Guardian | FR-ACC-01, -04, -10, FR-EX-07, -09, FR-PRG-01, -02, -05, NFR-US-02 |
| SG-3 Teacher | FR-ACC-05–07, FR-EX-01, -06, -07, -10, FR-PRG-03, -04, -06, FR-CNT-01, -02, -04 |
| SG-4 Administrator | FR-ACC-05, FR-CNT-03, FR-ADM-01, NFR-REL-01–03, NFR-MNT-01–03 |
| SG-5 Data protection | FR-ACC-02, -03, -07, -09, -11, FR-ADM-02, NFR-SEC-01–05, NFR-PRV-01–04, DR-01–06 |

---

## 7. Open issues

| ID | Issue | Owner |
|----|-------|-------|
| OI-1 | Confirm the TTS provider supports Finnish with word-level timing (A-1). | Team |
| OI-2 | Decide whether read-aloud mode (FR-EX-09) is in this release given the budget (C-4). | Team + course staff |
