import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Inbox, CheckCircle2, XCircle, CalendarDays, Send, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { PLATFORM_COLORS } from "@/components/StatusBadge";
import { Link } from "react-router-dom";

const stats = [
  { key: "pending_submissions", label: "Pending", icon: Inbox, color: "bg-yellow-300", to: "/review?status=pending" },
  { key: "approved_submissions", label: "Approved", icon: CheckCircle2, color: "bg-emerald-300", to: "/review?status=approved" },
  { key: "rejected_submissions", label: "Rejected", icon: XCircle, color: "bg-rose-300", to: "/review?status=rejected" },
  { key: "scheduled", label: "Scheduled", icon: CalendarDays, color: "bg-fuchsia-300", to: "/feed?status=scheduled" },
  { key: "published_this_month", label: "Published (this month)", icon: Send, color: "bg-blue-300", to: "/feed?status=published" },
  { key: "total_posts", label: "Total posts", icon: TrendingUp, color: "bg-orange-300", to: "/feed" },
];

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/admin/dashboard").then((r) => setData(r.data)).catch(() => {});
  }, []);

  const pieData = useMemo(() => (data?.by_platform || []).map((p) => ({ name: p.platform || "—", value: p.count, color: PLATFORM_COLORS[p.platform] || "#71717A" })), [data]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full bg-blue-300 text-xs font-black uppercase tracking-widest mb-2">
            Admin dashboard
          </div>
          <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight">The pulse of ISME social</h1>
          <p className="text-neutral-600 mt-1">Numbers refresh every time you open this page.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={s.to} data-testid={`stat-${s.key}`}>
              <Card className={`p-4 border-2 border-black rounded-xl ${s.color} brutal-shadow-hover cursor-pointer`}>
                <s.icon className="w-5 h-5" strokeWidth={2.5} />
                <div className="mt-4 font-display font-black text-3xl leading-none">{data?.[s.key] ?? "—"}</div>
                <div className="text-[11px] font-bold uppercase tracking-widest mt-1">{s.label}</div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3 p-5 border-2 border-black rounded-2xl bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-black text-xl">Posts by club</h2>
            <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Top clubs</span>
          </div>
          {data && (data.by_club || []).length === 0 ? (
            <div className="border-2 border-dashed border-black rounded-2xl p-10 text-center" style={{ height: 300 }}>
              <div className="font-display text-xl font-black">No posts yet</div>
              <p className="text-neutral-500 mt-1 text-sm">Once posts are published, this chart fills in club by club.</p>
            </div>
          ) : (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={data?.by_club || []} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E4E4E7" />
                  <XAxis dataKey="club_name" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip cursor={{ fill: "#FAFAFA" }} contentStyle={{ border: "2px solid #18181B", borderRadius: 8, fontWeight: 700 }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(data?.by_club || []).map((row, i) => (
                      <Cell key={i} fill={row.brand_color || "#3B82F6"} stroke="#18181B" strokeWidth={2} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2 p-5 border-2 border-black rounded-2xl bg-white">
          <h2 className="font-display font-black text-xl mb-4">Platform mix</h2>
          {data && pieData.length === 0 ? (
            <div className="border-2 border-dashed border-black rounded-2xl p-10 text-center" style={{ height: 300 }}>
              <div className="font-display text-xl font-black">No posts yet</div>
              <p className="text-neutral-500 mt-1 text-sm">The platform breakdown shows up here once something's published.</p>
            </div>
          ) : (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {pieData.map((p, i) => <Cell key={i} fill={p.color} stroke="#18181B" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip contentStyle={{ border: "2px solid #18181B", borderRadius: 8, fontWeight: 700 }} />
                  <Legend wrapperStyle={{ fontSize: 12, fontWeight: 700 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
