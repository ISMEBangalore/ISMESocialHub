import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=loading, false=logged out, {}=logged in
  const [ready, setReady] = useState(false);

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

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, formatApiError }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
