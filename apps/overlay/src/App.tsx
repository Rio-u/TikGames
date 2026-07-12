import { BrowserRouter, Route, Routes } from "react-router-dom";
import OverlayRoom from "./pages/OverlayRoom";

function Placeholder() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="rounded-xl border border-glass-border bg-canvas-soft/70 px-6 py-4 text-center shadow-glass backdrop-blur-xl">
        <p className="text-lg font-semibold">
          <span className="text-ink">Tik</span>
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Games</span>{" "}
          Overlay
        </p>
        <p className="mt-1 text-sm text-ink-muted">حط رابط الـ Overlay بتاعك من لوحة التحكم في OBS</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder />} />
        <Route path="/o/:overlayToken" element={<OverlayRoom />} />
      </Routes>
    </BrowserRouter>
  );
}
