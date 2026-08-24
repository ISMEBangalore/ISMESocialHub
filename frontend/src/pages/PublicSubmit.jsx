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

const ENTITY_ROLES = {
  Club: { label: "Which club?", placeholder: "Choose a club", empty: "No active clubs yet — ask an admin to create one." },
  Event: { label: "Which event?", placeholder: "Choose an event", empty: "No active events yet — ask an admin to create one." },
  House: { label: "Which house?", placeholder: "Choose a house", empty: "No active houses yet — ask an admin to create one." },
};

export default function PublicSubmit() {
  const nav = useNavigate();
  const [entities, setEntities] = useState({ Club: [], Event: [], House: [] });
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
    Promise.all([
      api.get("/clubs", { params: { status: "active", type: "club" } }),
      api.get("/clubs", { params: { status: "active", type: "event" } }),
      api.get("/clubs", { params: { status: "active", type: "house" } }),
    ]).then(([club, event, house]) => setEntities({ Club: club.data, Event: event.data, House: house.data })).catch(() => {});
  }, []);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === "string" ? v : v.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (ENTITY_ROLES[form.submitter_role] && !form.club_id) {
      toast.error(`Please select the ${form.submitter_role.toLowerCase()} you represent.`);
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
              <Label htmlFor="submit-name" className="text-xs font-bold uppercase tracking-widest">Your name</Label>
              <Input id="submit-name" data-testid="submit-name" value={form.submitter_name} onChange={set("submitter_name")} required className="border-2 border-black rounded-lg h-11 mt-1" />
            </div>
            <div>
              <Label htmlFor="submit-email" className="text-xs font-bold uppercase tracking-widest">Email</Label>
              <Input id="submit-email" data-testid="submit-email" type="email" value={form.submitter_email} onChange={set("submitter_email")} required className="border-2 border-black rounded-lg h-11 mt-1" />
            </div>
          </div>
          <div className="mt-4">
            <Label className="text-xs font-bold uppercase tracking-widest">You are a…</Label>
            <RadioGroup value={form.submitter_role} onValueChange={(v) => setForm((f) => ({ ...f, submitter_role: v, club_id: "" }))} className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-2">
              {["Student", "Faculty", "Club", "Event", "House"].map((r) => (
                <label key={r} className={`flex items-center gap-2 border-2 border-black rounded-lg px-3 py-2.5 cursor-pointer font-semibold ${form.submitter_role === r ? "bg-yellow-300" : "bg-white"}`}>
                  <RadioGroupItem value={r} id={`role-${r}`} data-testid={`submit-role-${r}`} />
                  {r}
                </label>
              ))}
            </RadioGroup>
          </div>
          {ENTITY_ROLES[form.submitter_role] && (
            <div className="mt-4">
              <Label htmlFor="submit-club" className="text-xs font-bold uppercase tracking-widest">{ENTITY_ROLES[form.submitter_role].label}</Label>
              <Select value={form.club_id} onValueChange={set("club_id")}>
                <SelectTrigger id="submit-club" aria-label={ENTITY_ROLES[form.submitter_role].label} data-testid="submit-club" className="border-2 border-black rounded-lg h-11 mt-1"><SelectValue placeholder={ENTITY_ROLES[form.submitter_role].placeholder} /></SelectTrigger>
                <SelectContent>
                  {entities[form.submitter_role].length === 0 && <div className="p-3 text-sm text-neutral-500">{ENTITY_ROLES[form.submitter_role].empty}</div>}
                  {entities[form.submitter_role].map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="border-2 border-black rounded-2xl bg-white p-6">
          <h2 className="font-display text-xl font-black mb-4">2. The content</h2>
          <div className="space-y-4">
            <div>
              <Label htmlFor="submit-title" className="text-xs font-bold uppercase tracking-widest">Title / headline</Label>
              <Input id="submit-title" data-testid="submit-title" value={form.title} onChange={set("title")} required maxLength={140} className="border-2 border-black rounded-lg h-11 mt-1" />
            </div>
            <div>
              <Label htmlFor="submit-content" className="text-xs font-bold uppercase tracking-widest">Content / brief</Label>
              <Textarea id="submit-content" data-testid="submit-content" value={form.content} onChange={set("content")} required rows={5}
                placeholder="What should this post say? Who is it for? Any hashtags?" className="border-2 border-black rounded-lg mt-1" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="submit-platform" className="text-xs font-bold uppercase tracking-widest">Suggested platform</Label>
                <Select value={form.suggested_platform} onValueChange={set("suggested_platform")}>
                  <SelectTrigger id="submit-platform" aria-label="Suggested platform" data-testid="submit-platform" className="border-2 border-black rounded-lg h-11 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="submit-type" className="text-xs font-bold uppercase tracking-widest">Post type</Label>
                <Select value={form.post_type} onValueChange={set("post_type")}>
                  <SelectTrigger id="submit-type" aria-label="Post type" data-testid="submit-type" className="border-2 border-black rounded-lg h-11 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="submit-media" className="text-xs font-bold uppercase tracking-widest">Media URL (optional)</Label>
                <Input id="submit-media" data-testid="submit-media" type="url" placeholder="https://drive.google.com/…" value={form.media_url} onChange={set("media_url")} className="border-2 border-black rounded-lg h-11 mt-1" />
              </div>
              <div>
                <Label htmlFor="submit-date" className="text-xs font-bold uppercase tracking-widest">Publish by (event date)</Label>
                <Input id="submit-date" data-testid="submit-date" type="date" value={form.publish_by} onChange={set("publish_by")} className="border-2 border-black rounded-lg h-11 mt-1" />
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

        <Button data-testid="submit-final" disabled={busy} type="submit" className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white border-2 border-black rounded-xl font-bold text-lg brutal-shadow-hover">
          <Send className="w-5 h-5 mr-2" strokeWidth={2.5} /> {busy ? "Submitting…" : "Submit for review"}
        </Button>
      </form>
    </div>
  );
}
