import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("isme_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 on a request that *sent* a token means the session itself is no longer
// valid (expired, malformed, user gone) - not a login-form credential check
// (those calls carry no Authorization header, so they fall through untouched).
// Show a plain "please log in again" instead of the raw backend detail
// ("Token expired", "Invalid token", ...). Navigation is left to AuthContext
// (via this event) so it happens as a normal SPA route change - a hard
// window.location redirect would reload the page before any toast could render.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const hadToken = !!err?.config?.headers?.Authorization;
    if (err?.response?.status === 401 && hadToken) {
      localStorage.removeItem("isme_token");
      if (err.response.data) err.response.data.detail = "Please log in again.";
      window.dispatchEvent(new Event("isme:session-expired"));
    }
    return Promise.reject(err);
  }
);

export function formatApiError(err) {
  const d = err?.response?.data?.detail;
  if (d == null) return err?.message || "Something went wrong";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((e) => (e?.msg ? e.msg : JSON.stringify(e))).join("; ");
  if (d?.msg) return d.msg;
  return String(d);
}
