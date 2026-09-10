import { useEffect, useRef, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { Sparkles, Mail, MessageCircle, ShieldAlert, ShieldCheck, RefreshCw, ExternalLink, Pencil, X, Globe } from "lucide-react";

const RUNNING_STATUSES = ["queued", "research_running", "content_running", "evaluation_running", "revising"];

const ISSUE_STYLES = {
  overstated: "bg-orange-300",
  unsupported: "bg-rose-400 text-white",
  tone: "bg-yellow-300",
};

export default function NewsletterPipeline() {
  const [runs, setRuns] = useState([]);
  const [busy, setBusy] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [active, setActive] = useState(null);
  const [draft, setDraft] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const pollRef = useRef(null);

  const load = async () => {
    setBusy(true);
    try {
      const r = await api.get("/admin/newsletter/runs");
      setRuns(r.data);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Poll the list while any run is still in progress
  useEffect(() => {
    const anyRunning = runs.some((r) => RUNNING_STATUSES.includes(r.status));
    clearInterval(pollRef.current);
    if (anyRunning) {
      pollRef.current = setInterval(load, 4000);
    }
    return () => clearInterval(pollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runs.map((r) => r.status).join(",")]);

  // Poll the open run detail while it's still in progress
  useEffect(() => {
    if (!active || !RUNNING_STATUSES.includes(active.status)) return;
    const t = setInterval(async () => {
      try {
        const r = await api.get(`/admin/newsletter/runs/${active.id}`);
        setActive(r.data);
        if (r.data.status === "ready_for_review") setDraft(r.data.content);
        setRuns((prev) => prev.map((x) => (x.id === r.data.id ? r.data : x)));
      } catch { /* keep polling silently */ }
    }, 3000);
    return () => clearInterval(t);
  }, [active]);

  const triggerRun = async () => {
    setTriggering(true);
    try {
      const r = await api.post("/admin/newsletter/runs");
      toast.success("Pipeline started — research agent is gathering this week's sources");
      setRuns((prev) => [r.data, ...prev]);
      openItem(r.data);
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setTriggering(false);
    }
  };

  const openItem = (run) => {
    setActive(run);
    setDraft(run.content || null);
    setRejectReason("");
  };

  const editable = active?.status === "ready_for_review";

  const updateItem = (i, patch) => {
    const items = draft.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it));
    setDraft({ ...draft, items });
  };
  const removeItem = (i) => {
    setDraft({ ...draft, items: draft.items.filter((_, idx) => idx !== i) });
  };
  const updateHighlight = (i, patch) => {
    const homepage_highlights = draft.homepage_highlights.map((h, idx) => (idx === i ? { ...h, ...patch } : h));
    setDraft({ ...draft, homepage_highlights });
  };

  const saveEdits = async () => {
    try {
      const r = await api.put(`/admin/newsletter/runs/${active.id}/content`, draft);
      toast.success("Draft updated");
      setActive(r.data);
      setDraft(r.data.content);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const approveAndSend = async () => {
    try {
      await saveEdits();
      const r = await api.post(`/admin/newsletter/runs/${active.id}/approve`);
      toast.success("Approved — pushed to email and WhatsApp");
      setActive(r.data);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const reject = async () => {
    try {
      const r = await api.post(`/admin/newsletter/runs/${active.id}/reject`, { reason: rejectReason });
      toast.success("Run rejected");
      setActive(r.data);
      load();
    } catch (err) { toast.error(formatApiError(err)); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full bg-fuchsia-300 text-xs font-black uppercase tracking-widest mb-2">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={3} /> AI Newsletter Pipeline
          </div>
          <h1 className="font-display text-4xl font-black">Research → Content → Fact-check</h1>
          <p className="text-neutral-600 mt-1 max-w-xl">
            Run the three-agent pipeline, review the draft next to the fact-check report, edit inline, then approve &amp; send to Email + WhatsApp in one action.
          </p>
        </div>
        <Button data-testid="trigger-newsletter-run" onClick={triggerRun} disabled={triggering}
          className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white border-2 border-black rounded-full brutal-shadow brutal-shadow-hover font-bold">
          <RefreshCw className={`w-4 h-4 mr-1.5 ${triggering ? "animate-spin" : ""}`} strokeWidth={2.5} />
          {triggering ? "Starting…" : "Run new pipeline"}
        </Button>
      </div>

      <div className="border-2 border-black rounded-2xl bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 border-b-2 border-black">
            <tr className="text-left">
              <th className="p-3 font-bold uppercase text-xs tracking-widest">Started</th>
              <th className="p-3 font-bold uppercase text-xs tracking-widest">Subject</th>
              <th className="p-3 font-bold uppercase text-xs tracking-widest">Status</th>
              <th className="p-3 font-bold uppercase text-xs tracking-widest">Risk</th>
              <th className="p-3 font-bold uppercase text-xs tracking-widest">Triggered by</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {busy && runs.length === 0 && (<tr><td colSpan={6} className="p-6 text-center text-neutral-500">Loading…</td></tr>)}
            {!busy && runs.length === 0 && (
              <tr><td colSpan={6} className="p-10 text-center">
                <div className="font-display text-2xl font-black">No runs yet</div>
                <div className="text-neutral-500">Kick off the pipeline to generate this week's draft.</div>
              </td></tr>
            )}
            {runs.map((r) => (
              <tr key={r.id} data-testid={`newsletter-row-${r.id}`} className="border-b border-neutral-200 hover:bg-yellow-50">
                <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-3 font-semibold max-w-xs truncate">{r.content?.subject_line || <span className="text-neutral-400">—</span>}</td>
                <td className="p-3"><StatusBadge status={r.status} /></td>
                <td className="p-3">{r.evaluation ? <StatusBadge status={r.evaluation.overall_risk} /> : <span className="text-neutral-400">—</span>}</td>
                <td className="p-3 text-xs text-neutral-500">{r.triggered_by}</td>
                <td className="p-3 text-right">
                  <Button size="sm" data-testid={`newsletter-open-${r.id}`} onClick={() => openItem(r)}
                    className="border-2 border-black bg-white text-black hover:bg-yellow-200 rounded-full font-bold">
                    Open
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto border-l-2 border-black">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display text-2xl">Newsletter run</SheetTitle>
                <SheetDescription>Started {new Date(active.created_at).toLocaleString()} by {active.triggered_by}</SheetDescription>
              </SheetHeader>

              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <StatusBadge status={active.status} />
                {active.evaluation && <StatusBadge status={active.evaluation.overall_risk} />}
                {active.revision_count > 0 && (
                  <span className="text-xs font-bold text-neutral-500">revised ×{active.revision_count}</span>
                )}
              </div>

              {RUNNING_STATUSES.includes(active.status) && (
                <div className="mt-4 border-2 border-black rounded-xl p-4 bg-sky-50 flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 animate-spin" strokeWidth={2.5} />
                  <div className="text-sm font-semibold">Agents are working — this updates automatically.</div>
                </div>
              )}

              {active.status === "failed" && (
                <div className="mt-4 border-2 border-black rounded-xl p-4 bg-rose-50">
                  <div className="font-bold text-rose-700 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Pipeline failed</div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{active.error}</p>
                </div>
              )}

              {active.research_items?.length > 0 && (
                <div className="mt-6">
                  <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
                    Research sources ({active.research_items.length})
                  </div>
                  <div className="border-2 border-black rounded-xl divide-y divide-neutral-200 max-h-48 overflow-y-auto">
                    {active.research_items.map((it, i) => (
                      <a key={i} href={it.source_url} target="_blank" rel="noreferrer"
                        className="flex items-start justify-between gap-2 p-2.5 text-sm hover:bg-yellow-50">
                        <div>
                          <div className="font-semibold">{it.headline}</div>
                          <div className="text-xs text-neutral-500">{it.source_name} · {it.publish_date} · {it.category}{it.confidence === "low" ? " · low confidence" : ""}</div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-1 text-neutral-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {draft && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500">
                    <Pencil className="w-3.5 h-3.5" /> Draft (editable)
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-500">Subject line</label>
                    <Input data-testid="newsletter-subject" value={draft.subject_line || ""}
                      disabled={!editable}
                      onChange={(e) => setDraft({ ...draft, subject_line: e.target.value })}
                      className="border-2 border-black rounded-lg mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-500">ISME's Analysis (leads the newsletter)</label>
                    <Textarea data-testid="newsletter-analysis" value={draft.analysis || ""}
                      disabled={!editable}
                      onChange={(e) => setDraft({ ...draft, analysis: e.target.value })}
                      rows={3} className="border-2 border-black rounded-lg mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-500">Intro</label>
                    <Textarea data-testid="newsletter-intro" value={draft.intro || ""}
                      disabled={!editable}
                      onChange={(e) => setDraft({ ...draft, intro: e.target.value })}
                      rows={2} className="border-2 border-black rounded-lg mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-500">Items</label>
                    <div className="space-y-3 mt-1">
                      {(draft.items || []).map((item, i) => (
                        <div key={i} className="border-2 border-black rounded-lg p-3 bg-white space-y-2">
                          <div className="flex items-start gap-2">
                            <Input data-testid={`newsletter-item-headline-${i}`} value={item.headline || ""}
                              disabled={!editable} placeholder="Headline"
                              onChange={(e) => updateItem(i, { headline: e.target.value })}
                              className="border-2 border-black rounded-lg font-semibold" />
                            {editable && (
                              <Button type="button" size="icon" variant="outline" data-testid={`newsletter-item-remove-${i}`}
                                onClick={() => removeItem(i)} className="border-2 border-black rounded-lg shrink-0">
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          <Textarea data-testid={`newsletter-item-blurb-${i}`} value={item.blurb || ""}
                            disabled={!editable} placeholder="Blurb"
                            onChange={(e) => updateItem(i, { blurb: e.target.value })}
                            rows={2} className="border-2 border-black rounded-lg text-sm" />
                          <Input data-testid={`newsletter-item-source-${i}`} value={item.source_url || ""}
                            disabled={!editable} placeholder="Source URL"
                            onChange={(e) => updateItem(i, { source_url: e.target.value })}
                            className="border-2 border-black rounded-lg text-xs" />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-500">Skill takeaway (leave blank to omit)</label>
                    <Textarea data-testid="newsletter-takeaway" value={draft.skill_takeaway || ""}
                      disabled={!editable}
                      onChange={(e) => setDraft({ ...draft, skill_takeaway: e.target.value })}
                      rows={2} className="border-2 border-black rounded-lg mt-1" />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-neutral-500">Homepage highlights</label>
                    <div className="space-y-2 mt-1">
                      {(draft.homepage_highlights || []).map((h, i) => (
                        <div key={i} className="flex gap-2">
                          <Input data-testid={`newsletter-highlight-text-${i}`} value={h.text || ""}
                            disabled={!editable} placeholder="Highlight"
                            onChange={(e) => updateHighlight(i, { text: e.target.value })}
                            className="border-2 border-black rounded-lg text-sm" />
                          <Input data-testid={`newsletter-highlight-source-${i}`} value={h.source_url || ""}
                            disabled={!editable} placeholder="Source URL"
                            onChange={(e) => updateHighlight(i, { source_url: e.target.value })}
                            className="border-2 border-black rounded-lg text-xs w-1/3" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {editable && (
                    <Button data-testid="newsletter-save-edits" onClick={saveEdits} variant="outline"
                      className="border-2 border-black rounded-full font-bold">
                      Save edits
                    </Button>
                  )}
                </div>
              )}

              {active.evaluation && (
                <div className="mt-6 border-2 border-black rounded-xl p-4 bg-neutral-50">
                  <div className="flex items-center gap-2 font-black">
                    {active.evaluation.overall_risk === "low" ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-rose-600" />}
                    Fact-check report
                  </div>
                  <p className="text-sm mt-2"><b>Citations:</b> {active.evaluation.citation_check}</p>
                  <p className="text-sm"><b>Recommendation:</b> {active.evaluation.recommendation?.replace(/_/g, " ")}</p>
                  {active.evaluation.flagged_claims?.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {active.evaluation.flagged_claims.map((f, i) => (
                        <div key={i} className="border-2 border-black rounded-lg p-3 bg-white">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-0.5 rounded-md border-2 border-black text-[10px] font-black uppercase ${ISSUE_STYLES[f.issue] || "bg-neutral-200"}`}>
                              {f.issue}
                            </span>
                          </div>
                          <p className="text-sm font-semibold">&ldquo;{f.claim}&rdquo;</p>
                          <p className="text-xs text-neutral-600 mt-1">{f.detail}</p>
                          <p className="text-xs text-neutral-800 mt-1"><b>Fix:</b> {f.suggested_fix}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm mt-2 text-emerald-700 font-semibold">No claims flagged.</p>
                  )}
                </div>
              )}

              {active.status === "ready_for_review" && (
                <div className="mt-6 space-y-3">
                  <Textarea data-testid="newsletter-reject-reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                    rows={2} placeholder="Reason for rejecting (optional)…" className="border-2 border-black rounded-lg" />
                  <div className="grid grid-cols-2 gap-3">
                    <Button data-testid="newsletter-reject" onClick={reject}
                      className="bg-rose-500 hover:bg-rose-600 text-white border-2 border-black rounded-full font-bold">
                      Reject
                    </Button>
                    <Button data-testid="newsletter-approve" onClick={approveAndSend}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-black rounded-full font-bold">
                      <Sparkles className="w-4 h-4 mr-1" /> Approve &amp; Send
                    </Button>
                  </div>
                </div>
              )}

              {active.status === "sent" && active.send_results && (
                <div className="mt-6 border-2 border-black rounded-xl p-4 bg-emerald-50 space-y-1">
                  <div className="font-black flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Sent</div>
                  <div className="text-sm flex items-center gap-2"><Mail className="w-4 h-4" /> Email: {active.send_results.email?.succeeded ?? 0}/{active.send_results.email?.attempted ?? 0} delivered</div>
                  <div className="text-sm flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp: {active.send_results.whatsapp?.sent ? `${active.send_results.whatsapp.succeeded}/${active.send_results.whatsapp.recipients} delivered` : "not configured"}</div>
                  <a href={`/newsletter/${active.id}`} target="_blank" rel="noreferrer" data-testid="newsletter-public-link"
                    className="text-sm flex items-center gap-2 text-blue-700 font-semibold underline mt-1">
                    <Globe className="w-4 h-4" /> View the public page
                  </a>
                </div>
              )}

              {active.approval_log?.length > 0 && (
                <div className="mt-6">
                  <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Review log</div>
                  <div className="space-y-1 text-xs text-neutral-600">
                    {active.approval_log.map((l, i) => (
                      <div key={i}>
                        {new Date(l.date).toLocaleString()} — {l.reviewer_email} {l.rejected ? "rejected" : `approved (edits: ${l.edits_made ? "yes" : "no"})`}
                        {l.reason ? ` — "${l.reason}"` : ""}
                      </div>
                    ))}
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
