import { useEffect, useMemo, useState } from "react";
import { api, API, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import StatusBadge, { CategoryPill } from "@/components/StatusBadge";
import { toast } from "sonner";
import { isAdminRole } from "@/lib/roles";
import { PartyPopper, Sparkles, RefreshCw, MessageCircle } from "lucide-react";

const RUNNING_STATUSES = ["generating"];

function monthLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function dayParts(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return { num: d.getDate(), dow: d.toLocaleDateString("en-US", { weekday: "short" }) };
}

export default function Festivities() {
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  const [festivals, setFestivals] = useState([]);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(null); // the greeting run being reviewed
  const [rejectReason, setRejectReason] = useState("");

  const load = () => {
    setBusy(true);
    api.get("/festivals").then((r) => setFestivals(r.data)).catch((err) => toast.error(formatApiError(err))).finally(() => setBusy(false));
  };
  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const groups = [];
    let current = null;
    for (const f of festivals) {
      const label = monthLabel(f.date);
      if (!current || current.label !== label) {
        current = { label, entries: [] };
        groups.push(current);
      }
      current.entries.push(f);
    }
    return groups;
  }, [festivals]);

  // Poll the open run while it's still generating
  useEffect(() => {
    if (!active || !RUNNING_STATUSES.includes(active.status)) return;
    const t = setInterval(async () => {
      try {
        const r = await api.get(`/admin/festivals/greetings/${active.id}`);
        setActive(r.data);
      } catch { /* keep polling silently */ }
    }, 2500);
    return () => clearInterval(t);
  }, [active]);

  const generateGreeting = async (festival) => {
    try {
      const r = await api.post(`/admin/festivals/${festival.id}/greeting`);
      toast.success(`Generating a ${festival.name} greeting…`);
      setActive(r.data);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const editable = active?.status === "ready_for_review";

  const saveEdits = async () => {
    try {
      const r = await api.put(`/admin/festivals/greetings/${active.id}`, {
        headline: active.headline, message: active.message, tagline: active.tagline || "",
      });
      setActive(r.data);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const approveAndSend = async () => {
    try {
      await saveEdits();
      const r = await api.post(`/admin/festivals/greetings/${active.id}/approve`);
      toast.success("Approved — pushed to WhatsApp");
      setActive(r.data);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const reject = async () => {
    try {
      const r = await api.post(`/admin/festivals/greetings/${active.id}/reject`, { reason: rejectReason });
      toast.success("Greeting rejected");
      setActive(r.data);
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full bg-fuchsia-300 text-xs font-black uppercase tracking-widest mb-2">
          <PartyPopper className="w-3.5 h-3.5" strokeWidth={3} /> Festivities
        </div>
        <h1 className="font-display text-4xl font-black">India's festivals, 2026</h1>
        <p className="text-neutral-600 mt-1">
          {isAdmin ? "Every major and regional Indian festival this year — generate a WhatsApp greeting (message + image) for any of them." : "Every major and regional Indian festival coming up this year."}
        </p>
      </div>

      {busy && festivals.length === 0 && <div className="p-10 text-center text-neutral-500">Loading…</div>}

      <div className="space-y-8">
        {grouped.map((g) => (
          <div key={g.label}>
            <h2 className="font-display text-xl font-black uppercase tracking-widest text-neutral-500 mb-3">{g.label}</h2>
            <div className="space-y-3">
              {g.entries.map((f) => {
                const { num, dow } = dayParts(f.date);
                return (
                  <div key={f.id} data-testid={`festival-row-${f.id}`} className="border-2 border-black rounded-2xl bg-white p-4 flex items-start gap-4 brutal-shadow-hover">
                    <div className="shrink-0 w-14 border-2 border-black rounded-xl bg-yellow-300 text-center py-1.5">
                      <div className="font-display font-black text-xl leading-none">{num}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest">{dow}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{f.name}</p>
                        <CategoryPill category={f.category} />
                      </div>
                      {f.blurb && <p className="text-sm text-neutral-500 mt-1">{f.blurb}</p>}
                    </div>
                    {isAdmin && (
                      <Button size="sm" data-testid={`festival-generate-${f.id}`} onClick={() => generateGreeting(f)}
                        className="shrink-0 bg-fuchsia-600 hover:bg-fuchsia-700 text-white border-2 border-black rounded-full font-bold">
                        <Sparkles className="w-4 h-4 mr-1" /> Generate greeting
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto border-l-2 border-black">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl">{active.festival_name} greeting</SheetTitle>
                <SheetDescription>Started {new Date(active.created_at).toLocaleString()}</SheetDescription>
              </SheetHeader>

              <div className="mt-3 flex items-center gap-2">
                <StatusBadge status={active.status} />
              </div>

              {active.status === "generating" && (
                <div className="mt-4 border-2 border-black rounded-xl p-4 bg-sky-50 flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 animate-spin" strokeWidth={2.5} />
                  <div className="text-sm font-semibold">Writing the message and rendering the image…</div>
                </div>
              )}

              {active.status === "failed" && (
                <div className="mt-4 border-2 border-black rounded-xl p-4 bg-rose-50">
                  <div className="font-bold text-rose-700">Generation failed</div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{active.error}</p>
                </div>
              )}

              {active.headline != null && (
                <div className="mt-6 space-y-4">
                  <div className="border-2 border-black rounded-xl overflow-hidden bg-neutral-100">
                    <img src={`${API}/festivals/greetings/${active.id}/image.png`} alt={active.festival_name} className="w-full" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-500">Tagline (subtle line above the headline, on the image)</label>
                    <Input data-testid="greeting-tagline" value={active.tagline || ""} disabled={!editable}
                      onChange={(e) => setActive({ ...active, tagline: e.target.value })}
                      className="border-2 border-black rounded-lg mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-500">Headline (on the image)</label>
                    <Input data-testid="greeting-headline" value={active.headline || ""} disabled={!editable}
                      onChange={(e) => setActive({ ...active, headline: e.target.value })}
                      className="border-2 border-black rounded-lg mt-1" />
                    <p className="text-xs text-neutral-400 mt-1">Editing the tagline or headline only updates the text fields — regenerate to bake new text into the image itself.</p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-500">WhatsApp message</label>
                    <Textarea data-testid="greeting-message" value={active.message || ""} disabled={!editable}
                      onChange={(e) => setActive({ ...active, message: e.target.value })}
                      rows={4} className="border-2 border-black rounded-lg mt-1" />
                  </div>

                  {editable && (
                    <Button data-testid="greeting-save" onClick={saveEdits} variant="outline" className="border-2 border-black rounded-full font-bold">
                      Save edits
                    </Button>
                  )}
                </div>
              )}

              {active.status === "ready_for_review" && (
                <div className="mt-6 space-y-3">
                  <Textarea data-testid="greeting-reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                    rows={2} placeholder="Reason for rejecting (optional)…" className="border-2 border-black rounded-lg" />
                  <div className="grid grid-cols-2 gap-3">
                    <Button data-testid="greeting-reject" onClick={reject}
                      className="bg-rose-500 hover:bg-rose-600 text-white border-2 border-black rounded-full font-bold">
                      Reject
                    </Button>
                    <Button data-testid="greeting-approve" onClick={approveAndSend}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-black rounded-full font-bold">
                      <Sparkles className="w-4 h-4 mr-1" /> Approve &amp; Send
                    </Button>
                  </div>
                </div>
              )}

              {active.status === "sent" && active.send_results && (
                <div className="mt-6 border-2 border-black rounded-xl p-4 bg-emerald-50 space-y-1">
                  <div className="font-black">Sent</div>
                  <div className="text-sm flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    WhatsApp: {active.send_results.whatsapp?.sent ? `${active.send_results.whatsapp.succeeded}/${active.send_results.whatsapp.recipients} delivered` : "not configured"}
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
