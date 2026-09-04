import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import StatusBadge from "@/components/StatusBadge";
import { isAdminRole } from "@/lib/roles";
import { Plus, Edit2, Trash2, Users, CalendarDays, Flag, Instagram, Linkedin, Twitter, Youtube, Facebook, Mail, User } from "lucide-react";

const TYPE_COPY = {
  club: {
    noun: "club", Icon: Users, badgeClass: "bg-sky-300",
    heading: "Every ISME club, in one place", badgeLabel: "Club directory",
    adminHint: "Add, edit or deactivate clubs.", memberHint: "Explore who's who on campus.",
    emptyTitle: "No clubs yet", emptySubtitle: "Ask an admin to add the first one.",
  },
  event: {
    noun: "event", Icon: CalendarDays, badgeClass: "bg-amber-300",
    heading: "Every ISME event, in one place", badgeLabel: "Event directory",
    adminHint: "Add, edit or deactivate events.", memberHint: "See what's happening on campus.",
    emptyTitle: "No events yet", emptySubtitle: "Ask an admin to add the first one.",
  },
  house: {
    noun: "house", Icon: Flag, badgeClass: "bg-lime-300",
    heading: "Every ISME house, in one place", badgeLabel: "House directory",
    adminHint: "Add, edit or deactivate houses.", memberHint: "See the campus house system.",
    emptyTitle: "No houses yet", emptySubtitle: "Ask an admin to add the first one.",
  },
};

function ClubForm({ type, initial, onSave, onClose }) {
  const copy = TYPE_COPY[type];
  const [f, setF] = useState(initial || {
    name: "", description: "", logo_url: "", lead_name: "", lead_email: "",
    faculty_incharge: "", student_coordinator: "", social_media_coordinator: "",
    instagram: "", linkedin: "", twitter: "", youtube: "", facebook: "",
    brand_color: "#3B82F6", status: "active", type,
  });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: typeof v === "string" ? v : v.target?.value ?? v }));
  const save = async () => {
    try {
      const payload = { ...f, type, lead_email: f.lead_email || null };
      await onSave(payload);
      toast.success(initial ? `${copy.noun[0].toUpperCase()}${copy.noun.slice(1)} updated` : `${copy.noun[0].toUpperCase()}${copy.noun.slice(1)} created`);
      onClose();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${type}-name`} className="text-xs font-bold uppercase tracking-widest">{copy.noun[0].toUpperCase()}{copy.noun.slice(1)} name</Label>
          <Input id={`${type}-name`} data-testid={`${type}-name`} value={f.name} onChange={set("name")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
        <div>
          <Label htmlFor={`${type}-color-text`} className="text-xs font-bold uppercase tracking-widest">Brand color</Label>
          <div className="flex gap-2 items-center mt-1">
            <Input id={`${type}-color`} aria-label="Brand color picker" data-testid={`${type}-color`} type="color" value={f.brand_color} onChange={set("brand_color")} className="border-2 border-black rounded-lg h-11 w-16 p-1" />
            <Input id={`${type}-color-text`} value={f.brand_color} onChange={set("brand_color")} className="border-2 border-black rounded-lg h-11 flex-1 font-mono" />
          </div>
        </div>
      </div>
      <div>
        <Label htmlFor={`${type}-desc`} className="text-xs font-bold uppercase tracking-widest">Description</Label>
        <Textarea id={`${type}-desc`} data-testid={`${type}-desc`} rows={3} value={f.description} onChange={set("description")} className="border-2 border-black rounded-lg mt-1" />
      </div>
      <div>
        <Label htmlFor={`${type}-logo`} className="text-xs font-bold uppercase tracking-widest">Logo URL</Label>
        <Input id={`${type}-logo`} data-testid={`${type}-logo`} value={f.logo_url} onChange={set("logo_url")} className="border-2 border-black rounded-lg h-11 mt-1" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${type}-lead-name`} className="text-xs font-bold uppercase tracking-widest">Lead name</Label>
          <Input id={`${type}-lead-name`} data-testid={`${type}-lead-name`} value={f.lead_name} onChange={set("lead_name")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
        <div>
          <Label htmlFor={`${type}-lead-email`} className="text-xs font-bold uppercase tracking-widest">Lead email</Label>
          <Input id={`${type}-lead-email`} data-testid={`${type}-lead-email`} type="email" value={f.lead_email} onChange={set("lead_email")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label htmlFor={`${type}-faculty-incharge`} className="text-xs font-bold uppercase tracking-widest">Faculty incharge</Label>
          <Input id={`${type}-faculty-incharge`} data-testid={`${type}-faculty-incharge`} value={f.faculty_incharge} onChange={set("faculty_incharge")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
        <div>
          <Label htmlFor={`${type}-student-coordinator`} className="text-xs font-bold uppercase tracking-widest">Student coordinator</Label>
          <Input id={`${type}-student-coordinator`} data-testid={`${type}-student-coordinator`} value={f.student_coordinator} onChange={set("student_coordinator")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
        <div>
          <Label htmlFor={`${type}-social-media-coordinator`} className="text-xs font-bold uppercase tracking-widest">Social media coordinator</Label>
          <Input id={`${type}-social-media-coordinator`} data-testid={`${type}-social-media-coordinator`} value={f.social_media_coordinator} onChange={set("social_media_coordinator")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {[["instagram","Instagram"],["linkedin","LinkedIn"],["twitter","Twitter/X"],["youtube","YouTube"],["facebook","Facebook"]].map(([k, l]) => (
          <div key={k}>
            <Label htmlFor={`${type}-${k}`} className="text-xs font-bold uppercase tracking-widest">{l} handle</Label>
            <Input id={`${type}-${k}`} data-testid={`${type}-${k}`} value={f[k]} onChange={set(k)} className="border-2 border-black rounded-lg h-11 mt-1" placeholder={`@${k}`} />
          </div>
        ))}
      </div>
      <div>
        <Label htmlFor={`${type}-status`} className="text-xs font-bold uppercase tracking-widest">Status</Label>
        <Select value={f.status} onValueChange={set("status")}>
          <SelectTrigger id={`${type}-status`} aria-label="Status" data-testid={`${type}-status`} className="border-2 border-black rounded-lg h-11 mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} data-testid={`${type}-cancel`} className="border-2 border-black rounded-full font-bold">Cancel</Button>
        <Button onClick={save} data-testid={`${type}-save`} className="bg-blue-600 hover:bg-blue-700 text-white border-2 border-black rounded-full font-bold">Save</Button>
      </div>
    </div>
  );
}

const socialIcons = {
  instagram: Instagram, linkedin: Linkedin, twitter: Twitter, youtube: Youtube, facebook: Facebook,
};

export default function Clubs({ type = "club" }) {
  const copy = TYPE_COPY[type];
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  const [items, setItems] = useState([]);
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/clubs", { params: { type } }).then((r) => setItems(r.data)).catch((err) => toast.error(formatApiError(err)));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [type]);

  const create = async (payload) => { const r = await api.post("/clubs", payload); setItems((c) => [...c, r.data].sort((a,b) => a.name.localeCompare(b.name))); };
  const update = async (id, payload) => { const r = await api.put(`/clubs/${id}`, payload); setItems((c) => c.map((x) => x.id === id ? r.data : x)); };
  const remove = async (id) => {
    if (!window.confirm(`Delete this ${copy.noun}? (Use Inactive to hide it instead.)`)) return;
    try { await api.delete(`/clubs/${id}`); setItems((c) => c.filter((x) => x.id !== id)); toast.success(`${copy.noun[0].toUpperCase()}${copy.noun.slice(1)} deleted`); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className={`inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full ${copy.badgeClass} text-xs font-black uppercase tracking-widest mb-2`}>
            <copy.Icon className="w-3.5 h-3.5" strokeWidth={3} /> {copy.badgeLabel}
          </div>
          <h1 className="font-display text-4xl font-black">{copy.heading}</h1>
          <p className="text-neutral-600 mt-1">{isAdmin ? copy.adminHint : copy.memberHint}</p>
        </div>
        {isAdmin && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button data-testid={`${type}s-new`} className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white border-2 border-black rounded-full brutal-shadow-hover font-bold">
                <Plus className="w-4 h-4 mr-1" /> New {copy.noun}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl border-2 border-black">
              <DialogHeader><DialogTitle className="font-display text-2xl">Add {["a","e","i","o","u"].includes(copy.noun[0]) ? "an" : "a"} {copy.noun}</DialogTitle></DialogHeader>
              <ClubForm type={type} onSave={create} onClose={() => setOpenNew(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {items.length === 0 && (
        <div className="border-2 border-dashed border-black rounded-2xl p-10 text-center bg-white">
          <div className="font-display text-3xl font-black">{copy.emptyTitle}</div>
          <p className="text-neutral-500 mt-1">{copy.emptySubtitle}</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((c) => (
          <div key={c.id} data-testid={`${type}-card-${c.id}`} className="border-2 border-black rounded-2xl bg-white overflow-hidden brutal-shadow-hover">
            <div className="h-3" style={{ background: c.brand_color }} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt={c.name} className="w-12 h-12 rounded-xl border-2 border-black object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl border-2 border-black grid place-items-center font-black text-xl"
                      style={{ background: c.brand_color, color: "#fff" }}>{c.name[0]}</div>
                  )}
                  <div>
                    <h3 className="font-display font-black text-lg leading-tight">{c.name}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button aria-label={`Edit ${c.name}`} data-testid={`${type}-edit-${c.id}`} onClick={() => setEditing(c)} className="w-8 h-8 border-2 border-black rounded-md bg-yellow-300 grid place-items-center hover:brutal-shadow"><Edit2 className="w-4 h-4" /></button>
                    <button aria-label={`Delete ${c.name}`} data-testid={`${type}-delete-${c.id}`} onClick={() => remove(c.id)} className="w-8 h-8 border-2 border-black rounded-md bg-rose-400 text-white grid place-items-center hover:brutal-shadow"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              {c.description && <p className="text-sm text-neutral-600 mt-3 line-clamp-2">{c.description}</p>}
              {(c.lead_name || c.lead_email) && (
                <div className="mt-3 text-xs text-neutral-500 space-y-1">
                  {c.lead_name && <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {c.lead_name}</div>}
                  {c.lead_email && <div className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {c.lead_email}</div>}
                </div>
              )}
              {(c.faculty_incharge || c.student_coordinator || c.social_media_coordinator) && (
                <div className="mt-3 text-xs text-neutral-600 space-y-1 border-t-2 border-dashed border-neutral-200 pt-2">
                  {c.faculty_incharge && <div><span className="font-bold uppercase tracking-widest text-[10px] text-neutral-400">Faculty:</span> {c.faculty_incharge}</div>}
                  {c.student_coordinator && <div><span className="font-bold uppercase tracking-widest text-[10px] text-neutral-400">Student coord:</span> {c.student_coordinator}</div>}
                  {c.social_media_coordinator && <div><span className="font-bold uppercase tracking-widest text-[10px] text-neutral-400">Social media coord:</span> {c.social_media_coordinator}</div>}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["instagram","linkedin","twitter","youtube","facebook"].map((k) => {
                  if (!c[k]) return null;
                  const Icon = socialIcons[k];
                  return (
                    <span key={k} data-testid={`${type}-social-${c.id}-${k}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border-2 border-black bg-neutral-100 text-xs font-bold">
                      <Icon className="w-3.5 h-3.5" strokeWidth={2.5} /> {c[k]}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl border-2 border-black">
          <DialogHeader><DialogTitle className="font-display text-2xl">Edit {copy.noun}</DialogTitle></DialogHeader>
          {editing && <ClubForm type={type} initial={editing} onSave={(p) => update(editing.id, p)} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
