import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Sparkles, ExternalLink } from "lucide-react";

export default function NewsletterView() {
  const { runId } = useParams();
  const [content, setContent] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get(`/newsletter/${runId}`)
      .then((r) => setContent(r.data))
      .catch(() => setNotFound(true));
  }, [runId]);

  if (notFound) {
    return (
      <div className="text-center py-20">
        <div className="font-display text-3xl font-black">Not found</div>
        <p className="text-neutral-500 mt-2">This newsletter isn't available — it may not have been sent yet.</p>
        <Link to="/" className="text-blue-600 underline font-semibold mt-4 inline-block">Back home</Link>
      </div>
    );
  }

  if (!content) {
    return <div className="p-10 text-center text-neutral-500">Loading…</div>;
  }

  return (
    <article className="max-w-2xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full bg-fuchsia-300 text-xs font-black uppercase tracking-widest mb-4">
        <Sparkles className="w-3.5 h-3.5" strokeWidth={3} /> AI & Management Education
      </div>
      <h1 className="font-display text-3xl sm:text-4xl font-black leading-tight">{content.subject_line}</h1>
      {content.sent_at && (
        <p className="text-neutral-500 text-sm mt-2">{new Date(content.sent_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
      )}

      {content.analysis && (
        <div className="mt-6 border-2 border-black rounded-xl p-4 bg-blue-50">
          <div className="text-xs font-black uppercase tracking-widest text-blue-600 mb-1">ISME's Analysis</div>
          <p className="text-neutral-800">{content.analysis}</p>
        </div>
      )}

      <p className="text-lg mt-6 text-neutral-800">{content.intro}</p>

      <div className="mt-8 space-y-6">
        {content.items?.map((item, i) => (
          <div key={i} className="border-l-4 border-blue-500 pl-4">
            <h2 className="font-display text-xl font-bold">{item.headline}</h2>
            <p className="text-neutral-700 mt-1">{item.blurb}</p>
            {item.source_url && (
              <a href={item.source_url} target="_blank" rel="noreferrer"
                className="text-sm text-blue-600 font-semibold inline-flex items-center gap-1 mt-2">
                Read the source <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>

      {content.skill_takeaway && (
        <div className="mt-8 border-2 border-black rounded-xl p-4 bg-yellow-100">
          <div className="text-xs font-black uppercase tracking-widest mb-1">Skill takeaway</div>
          <p className="text-neutral-800">{content.skill_takeaway}</p>
        </div>
      )}

      <footer className="mt-12 pt-6 border-t-2 border-black text-sm text-neutral-500">
        ISME AI & Management Education Newsletter — Bangalore
      </footer>
    </article>
  );
}
