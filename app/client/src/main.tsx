import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
// Self-hosted fonts, including the dyslexia-friendly OpenDyslexic (req 11).
import '@fontsource/opendyslexic/400.css';
import '@fontsource/lexend/400.css';
import '@fontsource/lexend/600.css';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import './styles.css';
import { SessionProvider, useSession } from './lib/session';
import { Home, Privacy } from './pages/Home';
import { Loading } from './components/Ui';
import { KidHome, KidShell, KidPlay, KidPractice, KidRecord, KidLeaderboard, KidSettings } from './pages/Kid';
import { TeacherHome, TeacherShell } from './pages/TeacherHome';
import { ClassPage } from './pages/ClassPage';
import { StudentPage } from './pages/StudentPage';
import { Library } from './pages/Library';
import { MyContent } from './pages/MyContent';

function Require({ kind, children }: { kind: 'teacher' | 'student'; children: ReactNode }) {
  const { me } = useSession();
  if (!me) return <Loading />;
  if (me.kind !== kind) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/privacy" element={<Privacy />} />

      <Route element={<Require kind="student"><KidShell /></Require>}>
        <Route path="/kid" element={<KidHome />} />
        <Route path="/kid/practice/:type" element={<KidPractice />} />
        <Route path="/kid/play/:id" element={<KidPlay />} />
        <Route path="/kid/record" element={<KidRecord />} />
        <Route path="/kid/leaderboard" element={<KidLeaderboard />} />
        <Route path="/kid/settings" element={<KidSettings />} />
      </Route>

      <Route element={<Require kind="teacher"><TeacherShell /></Require>}>
        <Route path="/teacher" element={<TeacherHome />} />
        <Route path="/teacher/class/:id" element={<ClassPage />} />
        <Route path="/teacher/student/:id" element={<StudentPage />} />
        <Route path="/teacher/library" element={<Library />} />
        <Route path="/teacher/content" element={<MyContent />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SessionProvider>
  </StrictMode>,
);
