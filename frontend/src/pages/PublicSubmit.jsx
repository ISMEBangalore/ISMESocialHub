import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Send, ArrowLeft, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

const PLATFORMS = ["Instagram", "LinkedIn", "Twitter", "YouTube", "Facebook"];
const TYPES = ["Reel", "Carousel", "Story", "Post", "Video", "Article"];

export default function PublicSubmit() {
  const nav = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [form, setForm] = useState({
    submitter_name: "",
    submitter_email: "",
    submitter_role: "Student",
    club_id: "",
    title: "",
    content: "",
    suggested_platform: "Instagram",
    post_type: "Post",
    media_url: "",
    publish_by: "",
    priority: "medium",
  });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.get("/clubs", { params: { status: "active" } }).then((r) => setClubs(r.data)).catch(() => {});
  }, []);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === "string" ? v : v.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.submitter_role === "Club" && !form.club_id) {
      toast.error("Please select the club you represent.");
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, club_id: form.club_id || null, publish_by: form.publish_by || null };
      const res = await api.post("/submissions", payload);
      setDone(res.data);
      toast.success("Submission received! Check your email for updates.");
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
        <div className="border-2 border-black rounded-2xl bg-emerald-300 p-8 brutal-shadow-lg">
          <div className="w-16 h-16 rounded-full border-2 border-black bg-white grid place-items-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" strokeWidth={2.5} />
          </div>
          <h1 className="font-display text-3xl font-black">Submission received!</h1>
          <p className="mt-2 text-neutral-800">Thanks {done.submitter_name}. We've emailed you a confirmation and will notify you when it's reviewed.</p>
          <div className="mt-6 bg-white border-2 border-black rounded-xl p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">Your submission ID</div>
            <div className="font-mono text-sm break-all mt-1">{done.id}</div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to={`/track?id=${done.id}&email=${encodeURIComponent(done.submitter_email)}`} data-testid="submit-track-btn">
              <Button className="bg-black hover:bg-neutral-800 text-white border-2 border-black rounded-full font-bold">Track my submission</Button>
            </Link>
            <Button data-testid="submit-another-btn" onClick={() => { setDone(null); setForm({ ...form, title: "", content: "", media_url: "" }); }}
              variant="outline" className="border-2 border-black rounded-full font-bold bg-white">Submit another</Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="grid lg:grid-cols-12 gap-8">
      <div className="lg:col-span-5">
        <button onClick={() => nav(-1)} className="text-sm font-bold text-neutral-500 hover:text-black flex items-center gap-1 mb-4" data-testid="submit-back">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="lg:sticky lg:top-24">
          <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full bg-fuchsia-300 text-xs font-black uppercase tracking-widest mb-4">
            <Send className="w-3.5 h-3.5" strokeWidth={3} /> Public form · no login needed
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-black leading-[1.05] tracking-tight">
            Got something worth posting?
          </h1>
          <p className="mt-4 text-neutral-600 text-base">
            Fill this in and the ISME social team will review, edit if needed, and schedule it across the right platforms.
            You'll get an email at each step.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="border-2 border-black rounded-xl p-3 bg-yellow-200">
              <div className="text-xs font-bold uppercase tracking-widest">Step 1</div>
              <div className="font-black text-sm mt-1">Tell us about you</div>
            </div>
            <div className="border-2 border-black rounded-xl p-3 bg-emerald-200">
              <div className="text-xs font-bold uppercase tracking-widest">Step 2</div>
              <div className="font-black text-sm mt-1">Share the content brief</div>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="lg:col-span-7 space-y-6" data-testid="submit-form">
        <div className="border-2 border-black rounded-2xl bg-white p-6">
          <h2 className="font-display text-xl font-black mb-4">1. About you</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest">Your name</Label>
              <Input data-testid="submit-name" value={form.submitter_name} onChange={set("submitter_name")} required className="border-2 border-black rounded-lg h-11 mt-1" />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest">Email</Label>
              <Input data-testid="submit-email" type="email" value={form.submitter_email} onChange={set("submitter_email")} required className="border-2 border-black rounded-lg h-11 mt-1" />
            </div>
          </div>
          <div className="mt-4">
            <Label className="text-xs font-bold uppercase tracking-widest">You are a…</Label>
            <RadioGroup value={form.submitter_role} onValueChange={set("submitter_role")} className="grid grid-cols-3 gap-3 mt-2">
              {["Student", "Faculty", "Club"].map((r) => (
                <label key={r} className={`flex items-center gap-2 border-2 border-black rounded-lg px-3 py-2.5 cursor-pointer font-semibold ${form.submitter_role === r ? "bg-yellow-300" : "bg-white"}`}>
                  <RadioGroupItem value={r} id={`role-${r}`} data-testid={`submit-role-${r}`} />
                  {r}
                </label>
              ))}
            </RadioGroup>
          </div>
          {form.submitter_role === "Club" && (
            <div className="mt-4">
              <Label className="text-xs font-bold uppercase tracking-widest">Which club?</Label>
              <Select value={form.club_id} onValueChange={set("club_id")}>
                <SelectTrigger data-testid="submit-club" className="border-2 border-black rounded-lg h-11 mt-1"><SelectValue placeholder="Choose a club" /></SelectTrigger>
                <SelectContent>
                  {clubs.length === 0 && <div className="p-3 text-sm text-neutral-500">No active clubs yet — ask an admin to create one.</div>}
                  {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="border-2 border-black rounded-2xl bg-white p-6">
          <h2 className="font-display text-xl font-black mb-4">2. The content</h2>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest">Title / headline</Label>
              <Input data-testid="submit-title" value={form.title} onChange={set("title")} required maxLength={140} className="border-2 border-black rounded-lg h-11 mt-1" />
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest">Content / brief</Label>
              <Textarea data-testid="submit-content" value={form.content} onChange={set("content")} required rows={5}
                placeholder="What should this post say? Who is it for? Any hashtags?" className="border-2 border-black rounded-lg mt-1" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest">Suggested platform</Label>
                <Select value={form.suggested_platform} onValueChange={set("suggested_platform")}>
                  <SelectTrigger data-testid="submit-platform" className="border-2 border-black rounded-lg h-11 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest">Post type</Label>
                <Select value={form.post_type} onValueChange={set("post_type")}>
                  <SelectTrigger data-testid="submit-type" className="border-2 border-black rounded-lg h-11 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest">Media URL (optional)</Label>
                <Input data-testid="submit-media" type="url" placeholder="https://drive.google.com/…" value={form.media_url} onChange={set("media_url")} className="border-2 border-black rounded-lg h-11 mt-1" />
              </div>
              <div>
                <Label className="text-xs font-bold uppercase tracking-widest">Publish by (event date)</Label>
                <Input data-testid="submit-date" type="date" value={form.publish_by} onChange={set("publish_by")} className="border-2 border-black rounded-lg h-11 mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest">Priority</Label>
              <RadioGroup value={form.priority} onValueChange={set("priority")} className="grid grid-cols-3 gap-3 mt-2">
                {["low", "medium", "high"].map((r) => (
                  <label key={r} className={`flex items-center gap-2 border-2 border-black rounded-lg px-3 py-2.5 cursor-pointer font-semibold uppercase text-xs tracking-widest ${form.priority === r ? "bg-fuchsia-300" : "bg-white"}`}>
                    <RadioGroupItem value={r} id={`pri-${r}`} data-testid={`submit-priority-${r}`} /> {r}
                  </label>
                ))}
              </RadioGroup>
            </div>
          </div>
        </div>

        <Button data-testid="submit-final" disabled={busy} type="submit" className="w-full h-14 bg-blue-500 hover:bg-blue-600 text-white border-2 border-black rounded-xl font-bold text-lg brutal-shadow-hover">
          <Send className="w-5 h-5 mr-2" strokeWidth={2.5} /> {busy ? "Submitting…" : "Submit for review"}
        </Button>
      </form>
    </div>
  );
}
