import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import StatusBadge, { PlatformPill } from "@/components/StatusBadge";
import { toast } from "sonner";
import { Search, RefreshCw } from "lucide-react";

export default function TrackSubmission() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [id, setId] = useState(params.get("id") || "");
  const [submissions, setSubmissions] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!email) return;
    setBusy(true);
    try {
      if (id) {
        const r = await api.get(`/submissions/${id}`, { params: { email } });
        setSubmissions([r.data]);
      } else {
        const r = await api.get("/submissions/mine", { params: { email } });
        setSubmissions(r.data);
      }
    } catch (err) {
      toast.error(formatApiError(err));
      setSubmissions([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (email) load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full bg-sky-300 text-xs font-black uppercase tracking-widest mb-4">
        <Search className="w-3.5 h-3.5" strokeWidth={3} /> Track your submissions
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-black">Where's your post?</h1>
      <p className="text-neutral-600 mt-1">Enter the email you used to submit. Optionally paste a submission ID for a direct link.</p>

      <div className="mt-6 border-2 border-black rounded-2xl bg-white p-5 grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <div>
          <Label htmlFor="track-email" className="text-xs font-bold uppercase tracking-widest">Email</Label>
          <Input id="track-email" data-testid="track-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="border-2 border-black rounded-lg h-11 mt-1" />
        </div>
        <div>
          <Label htmlFor="track-id" className="text-xs font-bold uppercase tracking-widest">Submission ID (optional)</Label>
          <Input id="track-id" data-testid="track-id" value={id} onChange={(e) => setId(e.target.value)} className="border-2 border-black rounded-lg h-11 mt-1 font-mono text-xs" />
        </div>
        <Button data-testid="track-search" onClick={load} disabled={!email || busy} className="h-11 bg-black hover:bg-neutral-800 text-white border-2 border-black rounded-lg font-bold">
          <RefreshCw className={`w-4 h-4 mr-2 ${busy ? "animate-spin" : ""}`} /> Load
        </Button>
      </div>

      <div className="mt-6 space-y-4">
        {submissions.length === 0 && (
          <div className="border-2 border-dashed border-black rounded-2xl p-10 text-center bg-white">
            <div className="font-display text-2xl font-black">No submissions yet</div>
            <p className="text-neutral-500 mt-1">Once you submit content, its status will show up here.</p>
            <Link to="/submit"><Button className="mt-4 bg-fuchsia-600 hover:bg-fuchsia-700 text-white border-2 border-black rounded-full font-bold">Submit content</Button></Link>
          </div>
        )}
        {submissions.map((s) => (
          <div key={s.id} data-testid={`track-item-${s.id}`} className="border-2 border-black rounded-2xl bg-white p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-black text-xl">{s.title}</h3>
                <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{s.content}</p>
              </div>
              <StatusBadge status={s.status} testId={`track-status-${s.id}`} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 items-center text-sm">
              <PlatformPill platform={s.suggested_platform} />
              <span className="border-2 border-black rounded-md px-2 py-0.5 text-xs font-bold bg-neutral-100">{s.post_type}</span>
              <span className="border-2 border-black rounded-md px-2 py-0.5 text-xs font-bold bg-yellow-100 uppercase tracking-widest">{s.priority}</span>
              {s.publish_by && <span className="text-neutral-500">by {new Date(s.publish_by).toLocaleDateString()}</span>}
            </div>
            {s.review_notes && (
              <div className="mt-4 border-l-4 border-fuchsia-500 pl-3 bg-fuchsia-50 py-2 rounded-r">
                <div className="text-xs font-bold uppercase tracking-widest text-fuchsia-700">Reviewer notes</div>
                <div className="text-sm mt-1">{s.review_notes}</div>
              </div>
            )}
            <div className="mt-3 text-xs text-neutral-400 font-mono">ID: {s.id}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
