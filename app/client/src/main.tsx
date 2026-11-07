import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
// Self-hosted fonts (no third-party requests — NFR-PRV-03)
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/600.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/opendyslexic/400.css';
import './styles.css';
import { I18nProvider } from './lib/i18n';
import { SessionProvider, useSession } from './lib/session';
import { Forgot, Home, Privacy, Register, Reset, Verify } from './pages/Public';
import { ClassPage, StudentPage, TeacherAccount, TeacherHome, TeacherPictures, TeacherTexts } from './pages/Teacher';
import { ChildExercise, ChildGate, ChildHome, ChildShell } from './child/ChildApp';
import { Loading } from './components/Layout';

function RequireTeacher({ children }: { children: ReactNode }) {
  const { me } = useSession();
  if (!me) return <Loading />;
  if (me.kind !== 'teacher') return <Navigate to="/?teacher" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* FR-ACC-00 — one entry route for children (default form) and teachers */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Navigate to="/?teacher" replace />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/reset" element={<Reset />} />
      <Route path="/privacy" element={<Privacy />} />

      <Route path="/teacher" element={<RequireTeacher><TeacherHome /></RequireTeacher>} />
      <Route path="/teacher/class/:id" element={<RequireTeacher><ClassPage /></RequireTeacher>} />
      <Route path="/teacher/student/:id" element={<RequireTeacher><StudentPage /></RequireTeacher>} />
      <Route path="/teacher/texts" element={<RequireTeacher><TeacherTexts /></RequireTeacher>} />
      <Route path="/teacher/pictures" element={<RequireTeacher><TeacherPictures /></RequireTeacher>} />
      <Route path="/teacher/account" element={<RequireTeacher><TeacherAccount /></RequireTeacher>} />

      <Route element={<ChildGate><ChildShell /></ChildGate>}>
        <Route path="/play" element={<ChildHome />} />
        <Route path="/play/exercise/:id" element={<ChildExercise />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <SessionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </SessionProvider>
    </I18nProvider>
  </StrictMode>,
);
