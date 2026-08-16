import { Badge } from "@/components/ui/badge";

const styles = {
  pending: "bg-yellow-300 text-black border-black",
  in_review: "bg-orange-300 text-black border-black",
  approved: "bg-emerald-400 text-black border-black",
  rejected: "bg-rose-400 text-white border-black",
  published: "bg-blue-500 text-white border-black",
  scheduled: "bg-fuchsia-400 text-black border-black",
  draft: "bg-neutral-200 text-black border-black",
  review: "bg-orange-300 text-black border-black",
  active: "bg-emerald-400 text-black border-black",
  inactive: "bg-neutral-300 text-black border-black",
  low: "bg-neutral-200 text-black border-black",
  medium: "bg-yellow-300 text-black border-black",
  high: "bg-rose-400 text-white border-black",
};

const labels = {
  pending: "PENDING",
  in_review: "IN REVIEW",
  approved: "APPROVED",
  rejected: "REJECTED",
  published: "PUBLISHED",
  scheduled: "SCHEDULED",
  draft: "DRAFT",
  review: "IN REVIEW",
  active: "ACTIVE",
  inactive: "INACTIVE",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};

export default function StatusBadge({ status, testId }) {
  const key = String(status || "").toLowerCase();
  const cls = styles[key] || "bg-neutral-200 text-black border-black";
  return (
    <Badge
      data-testid={testId}
      className={`${cls} border-2 rounded-full px-3 py-0.5 text-[10px] font-black tracking-widest uppercase`}
    >
      {labels[key] || key.toUpperCase()}
    </Badge>
  );
}

export const PLATFORM_COLORS = {
  Instagram: "#EC4899",
  LinkedIn: "#0A66C2",
  Twitter: "#18181B",
  YouTube: "#DC2626",
  Facebook: "#2563EB",
};

export function PlatformPill({ platform, testId }) {
  const color = PLATFORM_COLORS[platform] || "#3B82F6";
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border-2 border-black text-xs font-bold"
      style={{ background: color, color: platform === "Twitter" ? "#fff" : "#fff" }}
    >
      {platform}
    </span>
  );
}
