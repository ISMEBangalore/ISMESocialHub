import { useEffect, useMemo, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, CalendarClock } from "lucide-react";

const AUDIENCE_COLORS = {
  ALL: "bg-emerald-200", UG24: "bg-sky-200", UG25: "bg-sky-300", UG26: "bg-sky-400",
  PG25: "bg-fuchsia-200", PG26: "bg-fuchsia-300", HOSTEL: "bg-amber-200", FACULTY: "bg-neutral-300",
};
const audienceClass = (a) => AUDIENCE_COLORS[a] || "bg-lime-200";

function monthLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function dayParts(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return { num: d.getDate(), dow: d.toLocaleDateString("en-US", { weekday: "short" }) };
}

function EntryForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { date: "", activity: "", audience: "", academic_year: "2026-27", source: "SDC" });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: typeof v === "string" ? v : v.target.value }));
  const save = async () => {
    try {
      const payload = { ...f, audience: f.audience.split(",").map((a) => a.trim().toUpperCase()).filter(Boolean) };
      await onSave(payload);
      toast.success(initial ? "Calendar entry updated" : "Calendar entry added");
      onClose();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="cal-date" className="text-xs font-bold uppercase tracking-widest">Date</Label>
          <Input id="cal-date" data-testid="cal-date" type="date" value={f.date} onChange={set("date")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
        <div>
          <Label htmlFor="cal-year" className="text-xs font-bold uppercase tracking-widest">Academic year</Label>
          <Input id="cal-year" data-testid="cal-year" value={f.academic_year} onChange={set("academic_year")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
      </div>
      <div>
        <Label htmlFor="cal-activity" className="text-xs font-bold uppercase tracking-widest">Activity</Label>
        <Textarea id="cal-activity" data-testid="cal-activity" rows={3} value={f.activity} onChange={set("activity")} className="border-2 border-black rounded-lg mt-1" />
      </div>
      <div>
        <Label htmlFor="cal-audience" className="text-xs font-bold uppercase tracking-widest">Audience (comma-separated: ALL, UG24, UG25, UG26, PG25, PG26, HOSTEL, FACULTY)</Label>
        <Input id="cal-audience" data-testid="cal-audience" value={Array.isArray(f.audience) ? f.audience.join(", ") : f.audience} onChange={set("audience")} className="border-2 border-black rounded-lg h-11 mt-1" placeholder="ALL" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} data-testid="cal-cancel" className="border-2 border-black rounded-full font-bold">Cancel</Button>
        <Button onClick={save} data-testid="cal-save" className="bg-blue-600 hover:bg-blue-700 text-white border-2 border-black rounded-full font-bold">Save</Button>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState([]);
  const [audienceFilter, setAudienceFilter] = useState("ALL_FILTER");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/calendar").then((r) => setItems(r.data)).catch((err) => toast.error(formatApiError(err)));
  useEffect(() => { load(); }, []);

  const audiences = useMemo(() => {
    const s = new Set();
    items.forEach((it) => (it.audience || []).forEach((a) => s.add(a)));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    if (audienceFilter === "ALL_FILTER") return items;
    return items.filter((it) => (it.audience || []).includes(audienceFilter));
  }, [items, audienceFilter]);

  const grouped = useMemo(() => {
    const groups = [];
    let current = null;
    for (const it of filtered) {
      const label = monthLabel(it.date);
      if (!current || current.label !== label) {
        current = { label, entries: [] };
        groups.push(current);
      }
      current.entries.push(it);
    }
    return groups;
  }, [filtered]);

  const create = async (payload) => { const r = await api.post("/calendar", payload); setItems((c) => [...c, r.data].sort((a, b) => a.date.localeCompare(b.date))); };
  const update = async (id, payload) => { const r = await api.put(`/calendar/${id}`, payload); setItems((c) => c.map((x) => (x.id === id ? r.data : x))); };
  const remove = async (id) => {
    if (!window.confirm("Delete this calendar entry?")) return;
    try { await api.delete(`/calendar/${id}`); setItems((c) => c.filter((x) => x.id !== id)); toast.success("Calendar entry deleted"); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full bg-emerald-300 text-xs font-black uppercase tracking-widest mb-2">
            <CalendarClock className="w-3.5 h-3.5" strokeWidth={3} /> SDC academic calendar
          </div>
          <h1 className="font-display text-4xl font-black">Plan ahead of the calendar</h1>
          <p className="text-neutral-600 mt-1">{isAdmin ? "The full SDC 2026-27 schedule — add or edit entries as the calendar updates." : "See what's coming up so you can submit content ahead of time."}</p>
        </div>
        {isAdmin && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button data-testid="cal-new" className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white border-2 border-black rounded-full brutal-shadow-hover font-bold">
                <Plus className="w-4 h-4 mr-1" /> New entry
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl border-2 border-black">
              <DialogHeader><DialogTitle className="font-display text-2xl">Add a calendar entry</DialogTitle></DialogHeader>
              <EntryForm onSave={create} onClose={() => setOpenNew(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {audiences.length > 0 && (
        <div className="max-w-xs">
          <Label htmlFor="cal-filter" className="text-xs font-bold uppercase tracking-widest">Filter by audience</Label>
          <Select value={audienceFilter} onValueChange={setAudienceFilter}>
            <SelectTrigger id="cal-filter" aria-label="Filter by audience" data-testid="cal-filter" className="border-2 border-black rounded-lg h-11 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL_FILTER">Everyone</SelectItem>
              {audiences.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="border-2 border-dashed border-black rounded-2xl p-10 text-center bg-white">
          <div className="font-display text-3xl font-black">No calendar entries yet</div>
          <p className="text-neutral-500 mt-1">Ask an admin to add the first one.</p>
        </div>
      )}

      <div className="space-y-8">
        {grouped.map((g) => (
          <div key={g.label}>
            <h2 className="font-display text-xl font-black uppercase tracking-widest text-neutral-500 mb-3">{g.label}</h2>
            <div className="space-y-3">
              {g.entries.map((it) => {
                const { num, dow } = dayParts(it.date);
                return (
                  <div key={it.id} data-testid={`cal-entry-${it.id}`} className="border-2 border-black rounded-2xl bg-white p-4 flex items-start gap-4 brutal-shadow-hover">
                    <div className="shrink-0 w-14 border-2 border-black rounded-xl bg-yellow-300 text-center py-1.5">
                      <div className="font-display font-black text-xl leading-none">{num}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest">{dow}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{it.activity}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(it.audience || []).map((a) => (
                          <span key={a} className={`inline-flex items-center px-2 py-0.5 rounded-md border-2 border-black text-[10px] font-bold uppercase tracking-widest ${audienceClass(a)}`}>{a}</span>
                        ))}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        <button aria-label={`Edit entry on ${it.date}`} data-testid={`cal-edit-${it.id}`} onClick={() => setEditing(it)} className="w-8 h-8 border-2 border-black rounded-md bg-yellow-300 grid place-items-center hover:brutal-shadow"><Edit2 className="w-4 h-4" /></button>
                        <button aria-label={`Delete entry on ${it.date}`} data-testid={`cal-delete-${it.id}`} onClick={() => remove(it.id)} className="w-8 h-8 border-2 border-black rounded-md bg-rose-400 text-white grid place-items-center hover:brutal-shadow"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl border-2 border-black">
          <DialogHeader><DialogTitle className="font-display text-2xl">Edit calendar entry</DialogTitle></DialogHeader>
          {editing && <EntryForm initial={editing} onSave={(p) => update(editing.id, p)} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
