import { BrowserRouter, Route, Routes } from "react-router-dom";
import { GlowBackground } from "./components/GlowBackground";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./lib/auth";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import AuthCallback from "./pages/AuthCallback";
import CapitalsControl from "./pages/CapitalsControl";
import Dashboard from "./pages/Dashboard";
import FlagsControl from "./pages/FlagsControl";
import GuessNumberControl from "./pages/GuessNumberControl";
import Landing from "./pages/Landing";
import Leaderboard from "./pages/Leaderboard";
import LiveConnect from "./pages/LiveConnect";
import LiveSimulate from "./pages/LiveSimulate";
import LogosControl from "./pages/LogosControl";
import Login from "./pages/Login";
import MazeControl from "./pages/MazeControl";
import MusicalChairsControl from "./pages/MusicalChairsControl";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Register from "./pages/Register";
import SpeedWordControl from "./pages/SpeedWordControl";
import SpinWheelControl from "./pages/SpinWheelControl";
import Terms from "./pages/Terms";
import TriviaControl from "./pages/TriviaControl";
import WouldYouRatherControl from "./pages/WouldYouRatherControl";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GlowBackground />
        <a href="#main-content" className="skip-link rounded-full bg-primary px-4 py-2 text-sm text-white">
          تخطى إلى المحتوى
        </a>
        <div id="main-content">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <Leaderboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/connect"
              element={
                <ProtectedRoute>
                  <LiveConnect />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/musical-chairs"
              element={
                <ProtectedRoute>
                  <MusicalChairsControl />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/trivia"
              element={
                <ProtectedRoute>
                  <TriviaControl />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/guess-number"
              element={
                <ProtectedRoute>
                  <GuessNumberControl />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/spin-wheel"
              element={
                <ProtectedRoute>
                  <SpinWheelControl />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/would-you-rather"
              element={
                <ProtectedRoute>
                  <WouldYouRatherControl />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/flags"
              element={
                <ProtectedRoute>
                  <FlagsControl />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/capitals"
              element={
                <ProtectedRoute>
                  <CapitalsControl />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/logos"
              element={
                <ProtectedRoute>
                  <LogosControl />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/speed-word"
              element={
                <ProtectedRoute>
                  <SpeedWordControl />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/maze"
              element={
                <ProtectedRoute>
                  <MazeControl />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/simulate"
              element={
                <ProtectedRoute>
                  <LiveSimulate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/d7admind7"
              element={
                <ProtectedRoute role="ADMIN">
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
