import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StatusBadge, { PlatformPill } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Eye, CheckCircle2, XCircle, PlayCircle, Sparkles, Inbox } from "lucide-react";

const STATUSES = ["pending", "in_review", "approved", "rejected", "published"];

export default function ReviewQueue() {
  const [params, setParams] = useSearchParams();
  const initialStatus = params.get("status") || "pending";
  const [status, setStatus] = useState(initialStatus);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(null);
  const [notes, setNotes] = useState("");
  const [clubs, setClubs] = useState({});

  const load = async () => {
    setBusy(true);
    try {
      const [subs, clubList] = await Promise.all([
        api.get("/admin/submissions", { params: { status } }),
        api.get("/clubs"),
      ]);
      setItems(subs.data);
      const map = {};
      clubList.data.forEach((c) => (map[c.id] = c));
      setClubs(map);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  const openItem = (item) => { setActive(item); setNotes(item.review_notes || ""); };

  const doReview = async (newStatus) => {
    try {
      const r = await api.post(`/admin/submissions/${active.id}/review`, { status: newStatus, review_notes: notes });
      toast.success(`Marked as ${newStatus.replace("_", " ")}`);
      setActive(r.data);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const doConvert = async () => {
    try {
      const r = await api.post(`/admin/submissions/${active.id}/convert`);
      toast.success("Submission converted to a scheduled Post");
      setActive(null);
      load();
      return r.data;
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const changeStatus = (v) => { setStatus(v); setParams({ status: v }); };

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full bg-orange-300 text-xs font-black uppercase tracking-widest mb-2">
          <Inbox className="w-3.5 h-3.5" strokeWidth={3} /> Review queue
        </div>
        <h1 className="font-display text-4xl font-black">Approve, reject, schedule</h1>
        <p className="text-neutral-600 mt-1">Open any submission to review it side-by-side with the queue.</p>
      </div>

      <Tabs value={status} onValueChange={changeStatus}>
        <TabsList className="bg-white border-2 border-black rounded-lg p-1">
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s} data-testid={`tab-${s}`}
              className="data-[state=active]:bg-black data-[state=active]:text-white rounded-md font-bold uppercase text-xs tracking-widest px-3">
              {s.replace("_", " ")}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="border-2 border-black rounded-2xl bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 border-b-2 border-black">
            <tr className="text-left">
              <th className="p-3 font-bold uppercase text-xs tracking-widest">Title</th>
              <th className="p-3 font-bold uppercase text-xs tracking-widest">Submitter</th>
              <th className="p-3 font-bold uppercase text-xs tracking-widest">Club</th>
              <th className="p-3 font-bold uppercase text-xs tracking-widest">Platform</th>
              <th className="p-3 font-bold uppercase text-xs tracking-widest">Priority</th>
              <th className="p-3 font-bold uppercase text-xs tracking-widest">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {busy && (<tr><td colSpan={7} className="p-6 text-center text-neutral-500">Loading…</td></tr>)}
            {!busy && items.length === 0 && (
              <tr><td colSpan={7} className="p-10 text-center">
                <div className="font-display text-2xl font-black">Nothing here</div>
                <div className="text-neutral-500">No submissions with status <b>{status}</b>.</div>
              </td></tr>
            )}
            {items.map((s) => (
              <tr key={s.id} data-testid={`review-row-${s.id}`} className="border-b border-neutral-200 hover:bg-yellow-50">
                <td className="p-3 font-semibold">{s.title}</td>
                <td className="p-3">
                  <div>{s.submitter_name}</div>
                  <div className="text-xs text-neutral-500">{s.submitter_email} · {s.submitter_role}</div>
                </td>
                <td className="p-3">{s.club_id ? clubs[s.club_id]?.name || "—" : <span className="text-neutral-400">—</span>}</td>
                <td className="p-3"><PlatformPill platform={s.suggested_platform} /></td>
                <td className="p-3"><StatusBadge status={s.priority} /></td>
                <td className="p-3"><StatusBadge status={s.status} /></td>
                <td className="p-3 text-right">
                  <Button size="sm" data-testid={`review-open-${s.id}`} onClick={() => openItem(s)}
                    className="border-2 border-black bg-white text-black hover:bg-yellow-200 rounded-full font-bold">
                    <Eye className="w-4 h-4 mr-1" /> Review
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto border-l-2 border-black">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl">{active.title}</SheetTitle>
                <SheetDescription>
                  From {active.submitter_name} ({active.submitter_email}) — {active.submitter_role}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 flex flex-wrap gap-2">
                <PlatformPill platform={active.suggested_platform} />
                <span className="border-2 border-black rounded-md px-2 py-0.5 text-xs font-bold bg-neutral-100">{active.post_type}</span>
                <StatusBadge status={active.priority} />
                <StatusBadge status={active.status} />
              </div>

              {active.publish_by && <p className="mt-3 text-sm"><b>Publish by:</b> {new Date(active.publish_by).toLocaleDateString()}</p>}
              {active.club_id && clubs[active.club_id] && <p className="text-sm"><b>Club:</b> {clubs[active.club_id].name}</p>}

              <div className="mt-4 border-2 border-black rounded-xl p-4 bg-neutral-50">
                <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1">Content brief</div>
                <p className="whitespace-pre-wrap text-sm">{active.content}</p>
              </div>

              {active.media_url && (
                <a href={active.media_url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-blue-600 font-bold underline break-all text-sm">
                  Open media: {active.media_url}
                </a>
              )}

              <div className="mt-6">
                <div className="text-xs font-bold uppercase tracking-widest mb-2">Reviewer notes</div>
                <Textarea data-testid="review-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
                  className="border-2 border-black rounded-lg" placeholder="Add notes visible to the submitter (optional)…" />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <Button data-testid="review-mark-review" onClick={() => doReview("in_review")}
                  className="bg-orange-400 hover:bg-orange-500 text-black border-2 border-black rounded-full font-bold">
                  <Eye className="w-4 h-4 mr-1" /> In review
                </Button>
                <Button data-testid="review-approve" onClick={() => doReview("approved")}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-black rounded-full font-bold">
                  <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                </Button>
                <Button data-testid="review-reject" onClick={() => doReview("rejected")}
                  className="bg-rose-500 hover:bg-rose-600 text-white border-2 border-black rounded-full font-bold col-span-2">
                  <XCircle className="w-4 h-4 mr-1" /> Reject
                </Button>
              </div>

              {active.status === "approved" && (
                <div className="mt-6 border-2 border-black rounded-xl p-4 bg-fuchsia-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" strokeWidth={2.5} />
                    <div className="font-black">Ready to publish?</div>
                  </div>
                  <p className="text-sm mt-1 text-neutral-700">Convert this approved submission into a scheduled Post on the calendar.</p>
                  <Button data-testid="review-convert" onClick={doConvert}
                    className="mt-3 bg-black hover:bg-neutral-800 text-white border-2 border-black rounded-full font-bold">
                    <PlayCircle className="w-4 h-4 mr-1" /> Convert to scheduled post
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
