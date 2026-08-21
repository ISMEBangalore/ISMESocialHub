import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatApiError } from "@/lib/api";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await register(form.email, form.password, form.name);
      toast.success(`Account ready, ${u.name}!`);
      nav(u.role === "admin" ? "/dashboard" : "/feed");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="max-w-md mx-auto">
      <div className="border-2 border-black rounded-2xl bg-white p-8 brutal-shadow-lg">
        <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full bg-emerald-300 text-xs font-black uppercase tracking-widest mb-4">
          <UserPlus className="w-3.5 h-3.5" strokeWidth={3} /> Create account
        </div>
        <h1 className="font-display text-3xl font-black">Join the hub</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Registering with a seeded admin email will claim that admin account.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="register-name" className="text-xs font-bold uppercase tracking-widest">Full name</Label>
            <Input id="register-name" data-testid="register-name" value={form.name} onChange={set("name")} required
              className="border-2 border-black rounded-lg h-11 mt-1" />
          </div>
          <div>
            <Label htmlFor="register-email" className="text-xs font-bold uppercase tracking-widest">Email</Label>
            <Input id="register-email" data-testid="register-email" type="email" value={form.email} onChange={set("email")} required
              className="border-2 border-black rounded-lg h-11 mt-1" />
          </div>
          <div>
            <Label htmlFor="register-password" className="text-xs font-bold uppercase tracking-widest">Password (min 6 chars)</Label>
            <Input id="register-password" data-testid="register-password" type="password" minLength={6} value={form.password} onChange={set("password")} required
              className="border-2 border-black rounded-lg h-11 mt-1" />
          </div>
          <Button data-testid="register-submit" disabled={busy} type="submit"
            className="w-full h-11 bg-emerald-500 hover:bg-emerald-600 text-black border-2 border-black rounded-lg font-bold brutal-shadow-hover">
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>

        <div className="mt-6 text-sm">
          Have an account? <Link to="/login" data-testid="register-to-login" className="font-bold text-blue-600 hover:underline">Log in</Link>
        </div>
      </div>
    </div>
  );
}
