import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiError } from "@/lib/api";
import { isAdminRole } from "@/lib/roles";
import { toast } from "sonner";
import { LogIn } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email, password);
      toast.success(`Welcome, ${u.name || u.email}!`);
      nav(isAdminRole(u.role) ? "/dashboard" : "/feed");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 flex items-center justify-center px-8 pointer-events-none opacity-[0.18]"
      >
        <img src="/isme-logo.png" alt="" className="w-full max-w-7xl object-contain" />
      </div>
      <div className="max-w-md mx-auto relative">
        <div className="relative border-2 border-black rounded-2xl bg-white p-8 brutal-shadow-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full bg-blue-300 text-xs font-black uppercase tracking-widest mb-4">
            <LogIn className="w-3.5 h-3.5" strokeWidth={3} /> Log in
          </div>
          <h1 className="font-display text-3xl font-black">Welcome back</h1>
          <p className="text-sm text-neutral-500 mt-1">Sign in with your ISME Social Hub account.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="login-email" className="text-xs font-bold uppercase tracking-widest">Email</Label>
              <Input id="login-email" data-testid="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="border-2 border-black rounded-lg h-11 mt-1 focus-visible:ring-blue-500" />
            </div>
            <div>
              <Label htmlFor="login-password" className="text-xs font-bold uppercase tracking-widest">Password</Label>
              <Input id="login-password" data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="border-2 border-black rounded-lg h-11 mt-1 focus-visible:ring-blue-500" />
            </div>
            <Button data-testid="login-submit" disabled={busy} type="submit" className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white border-2 border-black rounded-lg font-bold brutal-shadow-hover">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link data-testid="login-to-forgot" to="/forgot-password" className="font-semibold text-blue-600 hover:underline">Forgot password?</Link>
            <Link data-testid="login-to-register" to="/register" className="font-semibold text-neutral-700 hover:underline">Create account →</Link>
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-4 text-center">
          Seeded admin accounts must be claimed via <span className="font-bold">Create account</span> on first use.
        </p>
      </div>
    </div>
  );
}
