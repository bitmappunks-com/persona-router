import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AppStateProvider } from "./state";
import { DirectoryPage } from "./pages/DirectoryPage";
import { HomePage } from "./pages/HomePage";
import { PersonaPage } from "./pages/PersonaPage";
import { SessionNewPage } from "./pages/SessionNewPage";
import { SessionPage } from "./pages/SessionPage";

export default function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/personas" element={<DirectoryPage />} />
            <Route path="/personas/:handle" element={<PersonaPage />} />
            <Route path="/session" element={<SessionNewPage />} />
            <Route path="/session/:id" element={<SessionPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  );
}
