import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import PublicSubmit from "@/pages/PublicSubmit";
import TrackSubmission from "@/pages/TrackSubmission";
import Dashboard from "@/pages/Dashboard";
import ReviewQueue from "@/pages/ReviewQueue";
import Feed from "@/pages/Feed";
import Clubs from "@/pages/Clubs";
import CalendarPage from "@/pages/CalendarPage";
import { isAdminRole } from "@/lib/roles";
import "@/App.css";

function HomeRoute() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="p-10 text-center text-neutral-500">Loading…</div>;
  if (user && user !== false) {
    return <Navigate to={isAdminRole(user.role) ? "/dashboard" : "/feed"} replace />;
  }
  return <Landing />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/submit" element={<PublicSubmit />} />
            <Route path="/track" element={<TrackSubmission />} />
            <Route path="/my-submissions" element={<TrackSubmission />} />
            <Route path="/clubs" element={<Clubs type="club" />} />
            <Route path="/events" element={<Clubs type="event" />} />
            <Route path="/houses" element={<Clubs type="house" />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/feed" element={
              <ProtectedRoute><Feed /></ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/review" element={
              <ProtectedRoute adminOnly><ReviewQueue /></ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
