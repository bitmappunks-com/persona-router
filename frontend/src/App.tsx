import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AppStateProvider } from "./state";
import { ChatsTab } from "./pages/ChatsTab";
import { ChatPane } from "./pages/ChatPane";
import { ContactsTab } from "./pages/ContactsTab";
import { ContactDetail } from "./pages/ContactDetail";
import { EmptyPane } from "./pages/EmptyPane";

export default function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/chats" replace />} />
            <Route path="/chats" element={<ChatsTab />}>
              <Route index element={<EmptyPane kind="chats" />} />
              <Route path=":id" element={<ChatPane />} />
            </Route>
            <Route path="/contacts" element={<ContactsTab />}>
              <Route index element={<EmptyPane kind="contacts" />} />
              <Route path=":handle" element={<ContactDetail />} />
            </Route>
            <Route path="*" element={<Navigate to="/chats" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  );
}
