import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=loading, false=logged out, {}=logged in
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("isme_token");
    if (!token) {
      setUser(false);
      setReady(true);
      return;
    }
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      localStorage.removeItem("isme_token");
      setUser(false);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("isme_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };
  const register = async (email, password, name) => {
    const res = await api.post("/auth/register", { email, password, name });
    localStorage.setItem("isme_token", res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };
  const logout = () => {
    localStorage.removeItem("isme_token");
    setUser(false);
  };

  // Fired by the API client on a 401 from an authenticated request - the
  // session is no longer valid. Log out and send them to /login as a normal
  // client-side route change (not a full reload) so any toast the caller
  // shows actually has time to render.
  useEffect(() => {
    const onExpired = () => {
      logout();
      if (!window.location.pathname.startsWith("/login")) {
        navigate("/login");
      }
    };
    window.addEventListener("isme:session-expired", onExpired);
    return () => window.removeEventListener("isme:session-expired", onExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, formatApiError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
