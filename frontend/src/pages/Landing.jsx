import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Sparkles, Send, Calendar, Users, LogIn, ArrowRight, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isAdminRole } from "@/lib/roles";

const HERO_IMG = "https://images.unsplash.com/photo-1549057446-9f5c6ac91a04?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwxfHxzdHVkZW50JTIwbGlmZSUyMGFjdGl2ZXxlbnwwfHx8fDE3ODY4MjE2MDd8MA&ixlib=rb-4.1.0&q=85";

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
      {/* Left */}
      <div className="lg:col-span-7">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1 border-2 border-black rounded-full bg-yellow-300 text-xs font-black uppercase tracking-widest mb-6">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={3} /> Internal · ISME Bangalore
          </div>
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight text-neutral-900">
            One hub for every <span className="bg-fuchsia-400 border-2 border-black px-2 -rotate-1 inline-block">club post.</span>
            <br />Zero email chaos.
          </h1>
          <p className="mt-6 text-lg text-neutral-600 max-w-2xl">
            Students, faculty and club reps submit content in seconds. Admins review, schedule and publish across
            Instagram, LinkedIn, Twitter, YouTube and Facebook — all from one clean workflow.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/submit" data-testid="hero-submit-btn">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white border-2 border-black rounded-full brutal-shadow brutal-shadow-hover font-bold text-base">
                <Send className="w-5 h-5 mr-2" strokeWidth={2.5} /> Submit content
              </Button>
            </Link>
            {!user ? (
              <Link to="/login" data-testid="hero-login-btn">
                <Button size="lg" variant="outline" className="border-2 border-black rounded-full font-bold text-base">
                  <LogIn className="w-5 h-5 mr-2" strokeWidth={2.5} /> Admin log in
                </Button>
              </Link>
            ) : (
              <Link to={isAdminRole(user.role) ? "/dashboard" : "/feed"} data-testid="hero-continue-btn">
                <Button size="lg" variant="outline" className="border-2 border-black rounded-full font-bold text-base">
                  Continue to app <ArrowRight className="w-5 h-5 ml-2" strokeWidth={2.5} />
                </Button>
              </Link>
            )}
          </div>

          <Link to="/track" data-testid="hero-track-link" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-neutral-600 hover:text-black">
            <Search className="w-4 h-4" strokeWidth={2.5} /> Already submitted something? Track it here
          </Link>

          <div className="mt-10 grid sm:grid-cols-3 gap-3">
            {[
              { icon: Send, label: "Submit in 60s", tint: "bg-emerald-300" },
              { icon: Calendar, label: "Live content calendar", tint: "bg-orange-300" },
              { icon: Users, label: "Every club in one place", tint: "bg-sky-300" },
            ].map((f) => (
              <div key={f.label} className={`${f.tint} border-2 border-black rounded-xl p-3 flex items-center gap-2`}>
                <f.icon className="w-4 h-4" strokeWidth={2.5} />
                <span className="text-sm font-bold">{f.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="lg:col-span-5"
      >
        <div className="relative">
          <div className="absolute -inset-3 bg-fuchsia-400 border-2 border-black rounded-3xl rotate-2" />
          <div className="relative border-2 border-black rounded-3xl overflow-hidden bg-white brutal-shadow-lg">
            <img src={HERO_IMG} alt="Students" className="w-full h-80 object-cover" />
            <div className="p-4 border-t-2 border-black bg-white flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">This month</div>
                <div className="font-display font-black text-2xl">42 posts · 8 clubs</div>
              </div>
              <div className="w-12 h-12 rounded-full border-2 border-black bg-emerald-400 grid place-items-center font-black text-lg">
                ↑
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
