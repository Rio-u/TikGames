import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { GlowBackground } from "./components/GlowBackground";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./lib/auth";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import Analytics from "./pages/Analytics";
import AuthCallback from "./pages/AuthCallback";
import CapitalsControl from "./pages/CapitalsControl";
import DrawingControl from "./pages/DrawingControl";
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
import Overlays from "./pages/Overlays";
import Overview from "./pages/Overview";
import Privacy from "./pages/Privacy";
import Register from "./pages/Register";
import SpeedWordControl from "./pages/SpeedWordControl";
import SpinWheelControl from "./pages/SpinWheelControl";
import Subscription from "./pages/Subscription";
import Terms from "./pages/Terms";
import TikGamesHub from "./pages/TikGamesHub";
import TikGamesLanding from "./pages/TikGamesLanding";
import Tools from "./pages/Tools";
import TriviaControl from "./pages/TriviaControl";
import WordRoundControl from "./pages/WordRoundControl";
import WouldYouRatherControl from "./pages/WouldYouRatherControl";

// The only route that mounts eighteen 3D scenes, and the one a streamer opens once. Loading it
// on demand keeps that weight off every other page, login included.
const DesignLab = lazy(() => import("./pages/DesignLab"));

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
            <Route path="/tikgames" element={<TikGamesLanding />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Overview />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/tikgames"
              element={
                <ProtectedRoute>
                  <TikGamesHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tools"
              element={
                <ProtectedRoute>
                  <Tools />
                </ProtectedRoute>
              }
            />
            <Route
              path="/overlays"
              element={
                <ProtectedRoute>
                  <Overlays />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/subscription"
              element={
                <ProtectedRoute>
                  <Subscription />
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
              path="/live/drawing"
              element={
                <ProtectedRoute>
                  <DrawingControl />
                </ProtectedRoute>
              }
            />
            <Route
              path="/live/word-round"
              element={
                <ProtectedRoute>
                  <WordRoundControl />
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
              path="/3d-designs"
              element={
                <ProtectedRoute role="ADMIN">
                  <Suspense fallback={null}>
                    <DesignLab />
                  </Suspense>
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
            <Route path="/d7logind7" element={<AdminLogin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
