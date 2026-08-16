import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import StatusBadge, { PlatformPill, PLATFORM_COLORS } from "@/components/StatusBadge";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Plus, Edit2, Trash2, CalendarDays, List, ExternalLink, Heart, MessageCircle, Share2 } from "lucide-react";
import { format, parseISO, isSameDay } from "date-fns";

const PLATFORMS = ["Instagram", "LinkedIn", "Twitter", "YouTube", "Facebook"];
const TYPES = ["Reel", "Carousel", "Story", "Post", "Video", "Article"];
const STATUSES = ["draft", "scheduled", "published", "review"];

function PostForm({ initial, clubs, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    title: "", content: "", club_id: "", platform: "Instagram", post_type: "Post",
    media_url: "", live_url: "", status: "draft", scheduled_date: "", published_date: "",
    tags: [], likes: 0, comments: 0, shares: 0,
  });
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: typeof v === "string" ? v : v.target?.value ?? v }));
  const setNum = (k) => (e) => setForm((f) => ({ ...f, [k]: Number(e.target.value) || 0 }));

  const save = async () => {
    const payload = {
      ...form,
      club_id: form.club_id || null,
      scheduled_date: form.scheduled_date || null,
      published_date: form.published_date || null,
      tags: typeof form.tags === "string" ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : form.tags,
    };
    try { await onSave(payload); toast.success(initial ? "Post updated" : "Post created"); onClose(); }
    catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-bold uppercase tracking-widest">Title</Label>
        <Input data-testid="post-title" value={form.title} onChange={set("title")} className="border-2 border-black rounded-lg h-11 mt-1" />
      </div>
      <div>
        <Label className="text-xs font-bold uppercase tracking-widest">Content</Label>
        <Textarea data-testid="post-content" rows={4} value={form.content} onChange={set("content")} className="border-2 border-black rounded-lg mt-1" />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest">Club</Label>
          <Select value={form.club_id || "none"} onValueChange={(v) => set("club_id")(v === "none" ? "" : v)}>
            <SelectTrigger data-testid="post-club" className="border-2 border-black rounded-lg h-11 mt-1"><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest">Platform</Label>
          <Select value={form.platform} onValueChange={set("platform")}>
            <SelectTrigger data-testid="post-platform" className="border-2 border-black rounded-lg h-11 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest">Post type</Label>
          <Select value={form.post_type} onValueChange={set("post_type")}>
            <SelectTrigger data-testid="post-type" className="border-2 border-black rounded-lg h-11 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest">Status</Label>
          <Select value={form.status} onValueChange={set("status")}>
            <SelectTrigger data-testid="post-status" className="border-2 border-black rounded-lg h-11 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest">Scheduled date</Label>
          <Input data-testid="post-scheduled" type="date" value={form.scheduled_date?.slice(0,10) || ""} onChange={set("scheduled_date")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest">Published date</Label>
          <Input data-testid="post-published" type="date" value={form.published_date?.slice(0,10) || ""} onChange={set("published_date")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest">Media URL</Label>
          <Input data-testid="post-media" value={form.media_url} onChange={set("media_url")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
        <div>
          <Label className="text-xs font-bold uppercase tracking-widest">Live URL</Label>
          <Input data-testid="post-live" value={form.live_url} onChange={set("live_url")} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
      </div>
      <div>
        <Label className="text-xs font-bold uppercase tracking-widest">Tags (comma separated)</Label>
        <Input data-testid="post-tags" value={Array.isArray(form.tags) ? form.tags.join(", ") : form.tags} onChange={set("tags")} className="border-2 border-black rounded-lg h-11 mt-1" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs font-bold uppercase tracking-widest">Likes</Label><Input data-testid="post-likes" type="number" value={form.likes} onChange={setNum("likes")} className="border-2 border-black rounded-lg h-11 mt-1" /></div>
        <div><Label className="text-xs font-bold uppercase tracking-widest">Comments</Label><Input data-testid="post-comments" type="number" value={form.comments} onChange={setNum("comments")} className="border-2 border-black rounded-lg h-11 mt-1" /></div>
        <div><Label className="text-xs font-bold uppercase tracking-widest">Shares</Label><Input data-testid="post-shares" type="number" value={form.shares} onChange={setNum("shares")} className="border-2 border-black rounded-lg h-11 mt-1" /></div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" data-testid="post-cancel" onClick={onClose} className="border-2 border-black rounded-full font-bold">Cancel</Button>
        <Button data-testid="post-save" onClick={save} className="bg-blue-500 hover:bg-blue-600 text-white border-2 border-black rounded-full font-bold">Save</Button>
      </div>
    </div>
  );
}

function CalendarView({ posts, clubs }) {
  const now = new Date();
  const [cur, setCur] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const days = useMemo(() => {
    const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cur.getFullYear(), cur.getMonth(), d));
    return cells;
  }, [cur]);

  const postsByDay = (d) => posts.filter((p) => {
    const iso = p.published_date || p.scheduled_date;
    if (!iso) return false;
    try { return isSameDay(parseISO(iso), d); } catch { return false; }
  });

  return (
    <div className="border-2 border-black rounded-2xl bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="font-display font-black text-xl">{format(cur, "MMMM yyyy")}</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" data-testid="cal-prev" onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth() - 1, 1))} className="border-2 border-black rounded-full font-bold">←</Button>
          <Button variant="outline" size="sm" data-testid="cal-today" onClick={() => setCur(new Date(now.getFullYear(), now.getMonth(), 1))} className="border-2 border-black rounded-full font-bold">Today</Button>
          <Button variant="outline" size="sm" data-testid="cal-next" onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth() + 1, 1))} className="border-2 border-black rounded-full font-bold">→</Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="p-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div key={i} className={`min-h-[92px] border-2 ${d ? "border-black bg-white" : "border-transparent"} rounded-lg p-1.5 text-xs`}>
            {d && (
              <>
                <div className={`font-black text-sm ${isSameDay(d, now) ? "text-blue-600" : ""}`}>{d.getDate()}</div>
                <div className="mt-1 space-y-1">
                  {postsByDay(d).slice(0, 3).map((p) => (
                    <div key={p.id} className="truncate rounded px-1 py-0.5 border border-black font-semibold text-[10px]"
                      style={{ background: PLATFORM_COLORS[p.platform] || "#3B82F6", color: "white" }}
                      title={p.title}>
                      {p.title}
                    </div>
                  ))}
                  {postsByDay(d).length > 3 && <div className="text-[10px] font-bold text-neutral-500">+{postsByDay(d).length - 3} more</div>}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Feed() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [params, setParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState(params.get("platform") || "all");
  const [club, setClub] = useState(params.get("club_id") || "all");
  const [status, setStatus] = useState(params.get("status") || "all");
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setBusy(true);
    try {
      const q = {};
      if (platform !== "all") q.platform = platform;
      if (club !== "all") q.club_id = club;
      if (status !== "all") q.status = status;
      const [p, c] = await Promise.all([api.get("/posts", { params: q }), api.get("/clubs")]);
      setPosts(p.data); setClubs(c.data);
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setBusy(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [platform, club, status]);

  useEffect(() => {
    const next = {};
    if (platform !== "all") next.platform = platform;
    if (club !== "all") next.club_id = club;
    if (status !== "all") next.status = status;
    setParams(next, { replace: true });
    // eslint-disable-next-line
  }, [platform, club, status]);

  const clubMap = useMemo(() => Object.fromEntries(clubs.map((c) => [c.id, c])), [clubs]);

  const create = async (payload) => {
    const r = await api.post("/posts", payload);
    setPosts((old) => [r.data, ...old]);
  };
  const update = async (id, payload) => {
    const r = await api.put(`/posts/${id}`, payload);
    setPosts((old) => old.map((p) => p.id === id ? r.data : p));
  };
  const remove = async (id) => {
    if (!window.confirm("Delete this post?")) return;
    await api.delete(`/posts/${id}`);
    setPosts((old) => old.filter((p) => p.id !== id));
    toast.success("Post deleted");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full bg-emerald-300 text-xs font-black uppercase tracking-widest mb-2">
            <CalendarDays className="w-3.5 h-3.5" strokeWidth={3} /> Content feed & calendar
          </div>
          <h1 className="font-display text-4xl font-black">What's going out</h1>
          <p className="text-neutral-600 mt-1">Filter by club, platform or status. Admins can add and edit here.</p>
        </div>
        {isAdmin && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button data-testid="feed-new-post" className="bg-blue-500 hover:bg-blue-600 text-white border-2 border-black rounded-full brutal-shadow-hover font-bold">
                <Plus className="w-4 h-4 mr-1" /> New post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl border-2 border-black">
              <DialogHeader><DialogTitle className="font-display text-2xl">New post</DialogTitle></DialogHeader>
              <PostForm clubs={clubs} onSave={create} onClose={() => setOpenNew(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger data-testid="filter-platform" className="border-2 border-black rounded-full h-10 w-40 font-bold"><SelectValue placeholder="Platform" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={club} onValueChange={setClub}>
          <SelectTrigger data-testid="filter-club" className="border-2 border-black rounded-full h-10 w-48 font-bold"><SelectValue placeholder="Club" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All clubs</SelectItem>
            {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger data-testid="filter-status" className="border-2 border-black rounded-full h-10 w-40 font-bold"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="list">
        <TabsList className="bg-white border-2 border-black rounded-lg p-1">
          <TabsTrigger value="list" data-testid="tab-list" className="data-[state=active]:bg-black data-[state=active]:text-white rounded-md font-bold uppercase text-xs tracking-widest px-3"><List className="w-3.5 h-3.5 mr-1" /> Feed</TabsTrigger>
          <TabsTrigger value="calendar" data-testid="tab-calendar" className="data-[state=active]:bg-black data-[state=active]:text-white rounded-md font-bold uppercase text-xs tracking-widest px-3"><CalendarDays className="w-3.5 h-3.5 mr-1" /> Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {busy && <div className="col-span-full text-neutral-500 p-6 text-center">Loading…</div>}
            {!busy && posts.length === 0 && (
              <div className="col-span-full border-2 border-dashed border-black rounded-2xl p-10 text-center bg-white">
                <div className="font-display text-2xl font-black">Nothing scheduled yet</div>
                <div className="text-neutral-500 mt-1">Approve a submission and convert it to a post, or add one directly.</div>
              </div>
            )}
            {posts.map((p) => (
              <div key={p.id} data-testid={`post-card-${p.id}`} className="border-2 border-black rounded-2xl bg-white overflow-hidden brutal-shadow-hover">
                <div className="p-2 border-b-2 border-black" style={{ background: PLATFORM_COLORS[p.platform] || "#3B82F6" }}>
                  <div className="flex items-center justify-between">
                    <PlatformPill platform={p.platform} />
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">{p.post_type} · {clubMap[p.club_id]?.name || "Unassigned"}</div>
                  <h3 className="font-display font-black text-lg mt-1">{p.title}</h3>
                  <p className="text-sm text-neutral-600 line-clamp-3 mt-1">{p.content}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
                    {p.scheduled_date && <span>📅 {format(parseISO(p.scheduled_date), "MMM d, yyyy")}</span>}
                    {p.published_date && <span>✅ {format(parseISO(p.published_date), "MMM d, yyyy")}</span>}
                  </div>
                  {(p.likes > 0 || p.comments > 0 || p.shares > 0) && (
                    <div className="mt-3 flex gap-3 text-xs font-bold text-neutral-700">
                      <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> {p.likes}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {p.comments}</span>
                      <span className="flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /> {p.shares}</span>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2 justify-between">
                    {p.live_url ? (
                      <a href={p.live_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"><ExternalLink className="w-3.5 h-3.5" /> View live</a>
                    ) : <span />}
                    {isAdmin && (
                      <div className="flex gap-1.5">
                        <button data-testid={`post-edit-${p.id}`} onClick={() => setEditing(p)} className="w-8 h-8 border-2 border-black rounded-md bg-yellow-300 grid place-items-center hover:brutal-shadow"><Edit2 className="w-4 h-4" /></button>
                        <button data-testid={`post-delete-${p.id}`} onClick={() => remove(p.id)} className="w-8 h-8 border-2 border-black rounded-md bg-rose-400 text-white grid place-items-center hover:brutal-shadow"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <CalendarView posts={posts} clubs={clubs} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl border-2 border-black">
          <DialogHeader><DialogTitle className="font-display text-2xl">Edit post</DialogTitle></DialogHeader>
          {editing && <PostForm initial={editing} clubs={clubs} onSave={(p) => update(editing.id, p)} onClose={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
