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
import { Plus, Edit2, Trash2, Users, Instagram, Linkedin, Twitter, Youtube, Facebook, Mail, User } from "lucide-react";

function ClubForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || {
    name: "", description: "", logo_url: "", lead_name: "", lead_email: "",
    instagram: "", linkedin: "", twitter: "", youtube: "", facebook: "",
    brand_color: "#3B82F6", status: "active",
  });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: typeof v === "string" ? v : v.target?.value ?? v }));
  const save = async () => {
    try {
      const payload = { ...f, lead_email: f.lead_email || null };
      await onSave(payload);
      toast.success(initial ? "Club updated" : "Club created");
      onClose();
    } catch (err) { toast.error(formatApiError(err)); }
  };
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest">Club name</Label>
          <Input data-testid="club-name" value={f.name} onChange={set("name")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest">Brand color</Label>
          <div className="flex gap-2 items-center mt-1">
            <Input data-testid="club-color" type="color" value={f.brand_color} onChange={set("brand_color")} className="border-2 border-black rounded-lg h-11 w-16 p-1" />
            <Input value={f.brand_color} onChange={set("brand_color")} className="border-2 border-black rounded-lg h-11 flex-1 font-mono" />
          </div>
        </div>
      </div>
      <div>
        <Label className="text-xs font-bold uppercase tracking-widest">Description</Label>
        <Textarea data-testid="club-desc" rows={3} value={f.description} onChange={set("description")} className="border-2 border-black rounded-lg mt-1" />
      </div>
      <div>
        <Label className="text-xs font-bold uppercase tracking-widest">Logo URL</Label>
        <Input data-testid="club-logo" value={f.logo_url} onChange={set("logo_url")} className="border-2 border-black rounded-lg h-11 mt-1" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest">Lead name</Label>
          <Input data-testid="club-lead-name" value={f.lead_name} onChange={set("lead_name")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest">Lead email</Label>
          <Input data-testid="club-lead-email" type="email" value={f.lead_email} onChange={set("lead_email")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {[["instagram","Instagram"],["linkedin","LinkedIn"],["twitter","Twitter/X"],["youtube","YouTube"],["facebook","Facebook"]].map(([k, l]) => (
          <div key={k}>
            <Label className="text-xs font-bold uppercase tracking-widest">{l} handle</Label>
            <Input data-testid={`club-${k}`} value={f[k]} onChange={set(k)} className="border-2 border-black rounded-lg h-11 mt-1" placeholder={`@${k}`} />
          </div>
        ))}
      </div>
      <div>
        <Label className="text-xs font-bold uppercase tracking-widest">Status</Label>
        <Select value={f.status} onValueChange={set("status")}>
          <SelectTrigger data-testid="club-status" className="border-2 border-black rounded-lg h-11 mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} data-testid="club-cancel" className="border-2 border-black rounded-full font-bold">Cancel</Button>
        <Button onClick={save} data-testid="club-save" className="bg-blue-500 hover:bg-blue-600 text-white border-2 border-black rounded-full font-bold">Save</Button>
      </div>
    </div>
  );
}

const socialIcons = {
  instagram: Instagram, linkedin: Linkedin, twitter: Twitter, youtube: Youtube, facebook: Facebook,
};

export default function Clubs() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [clubs, setClubs] = useState([]);
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/clubs").then((r) => setClubs(r.data)).catch((err) => toast.error(formatApiError(err)));
  useEffect(() => { load(); }, []);

  const create = async (payload) => { const r = await api.post("/clubs", payload); setClubs((c) => [...c, r.data].sort((a,b) => a.name.localeCompare(b.name))); };
  const update = async (id, payload) => { const r = await api.put(`/clubs/${id}`, payload); setClubs((c) => c.map((x) => x.id === id ? r.data : x)); };
  const remove = async (id) => {
    if (!window.confirm("Delete this club? (Use Inactive to hide it instead.)")) return;
    try { await api.delete(`/clubs/${id}`); setClubs((c) => c.filter((x) => x.id !== id)); toast.success("Club deleted"); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full bg-sky-300 text-xs font-black uppercase tracking-widest mb-2">
            <Users className="w-3.5 h-3.5" strokeWidth={3} /> Club directory
          </div>
          <h1 className="font-display text-4xl font-black">Every ISME club, in one place</h1>
          <p className="text-neutral-600 mt-1">{isAdmin ? "Add, edit or deactivate clubs." : "Explore who's who on campus."}</p>
        </div>
        {isAdmin && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button data-testid="clubs-new" className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white border-2 border-black rounded-full brutal-shadow-hover font-bold">
                <Plus className="w-4 h-4 mr-1" /> New club
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl border-2 border-black">
              <DialogHeader><DialogTitle className="font-display text-2xl">Add a club</DialogTitle></DialogHeader>
              <ClubForm onSave={create} onClose={() => setOpenNew(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {clubs.length === 0 && (
        <div className="border-2 border-dashed border-black rounded-2xl p-10 text-center bg-white">
          <div className="font-display text-3xl font-black">No clubs yet</div>
          <p className="text-neutral-500 mt-1">Ask an admin to add the first one.</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {clubs.map((c) => (
          <div key={c.id} data-testid={`club-card-${c.id}`} className="border-2 border-black rounded-2xl bg-white overflow-hidden brutal-shadow-hover">
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
                    <button data-testid={`club-edit-${c.id}`} onClick={() => setEditing(c)} className="w-8 h-8 border-2 border-black rounded-md bg-yellow-300 grid place-items-center hover:brutal-shadow"><Edit2 className="w-4 h-4" /></button>
                    <button data-testid={`club-delete-${c.id}`} onClick={() => remove(c.id)} className="w-8 h-8 border-2 border-black rounded-md bg-rose-400 text-white grid place-items-center hover:brutal-shadow"><Trash2 className="w-4 h-4" /></button>
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
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["instagram","linkedin","twitter","youtube","facebook"].map((k) => {
                  if (!c[k]) return null;
                  const Icon = socialIcons[k];
                  return (
                    <span key={k} data-testid={`club-social-${c.id}-${k}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border-2 border-black bg-neutral-100 text-xs font-bold">
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
          <DialogHeader><DialogTitle className="font-display text-2xl">Edit club</DialogTitle></DialogHeader>
          {editing && <ClubForm initial={editing} onSave={(p) => update(editing.id, p)} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
