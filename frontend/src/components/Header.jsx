import { NavLink, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { LayoutDashboard, Inbox, CalendarDays, Users, LogOut, Send, Menu, X, User2, Search } from "lucide-react";
import { useState } from "react";

const memberLinks = [
  { to: "/feed", label: "Feed", icon: CalendarDays, testId: "nav-feed" },
  { to: "/clubs", label: "Clubs", icon: Users, testId: "nav-clubs" },
];
const adminLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testId: "nav-dashboard" },
  { to: "/review", label: "Review Queue", icon: Inbox, testId: "nav-review" },
  { to: "/feed", label: "Feed & Calendar", icon: CalendarDays, testId: "nav-feed" },
  { to: "/clubs", label: "Clubs", icon: Users, testId: "nav-clubs" },
];

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const isAdmin = user && user.role === "admin";
  const links = isAdmin ? adminLinks : memberLinks;

  const doLogout = () => { logout(); navigate("/"); };

  return (
    <header className="sticky top-0 z-30 bg-white border-b-2 border-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" data-testid="brand-logo" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-lg border-2 border-black bg-blue-500 grid place-items-center brutal-shadow group-hover:translate-x-[-1px] group-hover:translate-y-[-1px] transition-transform">
            <span className="font-display font-black text-white text-lg">i</span>
          </div>
          <div>
            <div className="font-display font-black text-lg leading-none">ISME</div>
            <div className="text-[10px] font-bold tracking-widest text-neutral-500 leading-none">SOCIAL HUB</div>
          </div>
        </Link>

        {user && user !== false && (
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                data-testid={l.testId}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors ${
                    isActive ? "bg-black text-white" : "text-neutral-700 hover:bg-neutral-100"
                  }`
                }
              >
                <l.icon className="w-4 h-4" strokeWidth={2.5} />
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <Link to="/track" data-testid="nav-track" className="hidden sm:block">
            <Button variant="outline" className="border-2 border-black rounded-full font-bold">
              <Search className="w-4 h-4 mr-1.5" strokeWidth={2.5} /> Track submission
            </Button>
          </Link>
          <Link to="/submit" data-testid="nav-submit-cta" className="hidden sm:block">
            <Button className="bg-fuchsia-500 hover:bg-fuchsia-600 text-white border-2 border-black rounded-full brutal-shadow brutal-shadow-hover font-bold">
              <Send className="w-4 h-4 mr-1.5" strokeWidth={2.5} /> Submit Post
            </Button>
          </Link>

          {user && user !== false ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button data-testid="user-menu-trigger" className="w-10 h-10 rounded-full border-2 border-black bg-yellow-300 grid place-items-center font-black brutal-shadow hover:translate-x-[-1px] hover:translate-y-[-1px] transition-transform">
                  {(user.name || user.email || "?")[0]?.toUpperCase()}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-2 border-black brutal-shadow rounded-lg">
                <DropdownMenuLabel className="font-bold">
                  <div className="text-sm">{user.name}</div>
                  <div className="text-xs text-neutral-500 font-normal">{user.email}</div>
                  <div className="text-[10px] uppercase tracking-widest mt-1 text-blue-600">{user.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/my-submissions")} data-testid="menu-my-submissions">
                  <User2 className="w-4 h-4 mr-2" /> My Submissions
                </DropdownMenuItem>
                <DropdownMenuItem onClick={doLogout} data-testid="menu-logout" className="text-red-600">
                  <LogOut className="w-4 h-4 mr-2" /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden sm:flex items-center gap-2">
              <Link to="/login" data-testid="nav-login">
                <Button variant="outline" className="border-2 border-black rounded-full font-bold">Log in</Button>
              </Link>
            </div>
          )}

          <button onClick={() => setOpen(!open)} className="md:hidden w-10 h-10 border-2 border-black rounded-lg grid place-items-center" data-testid="mobile-menu-toggle">
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t-2 border-black bg-white px-4 py-3 flex flex-col gap-1">
          {(user && user !== false ? links : []).map((l) => (
            <NavLink key={l.to} to={l.to} onClick={() => setOpen(false)}
              data-testid={`m-${l.testId}`}
              className={({ isActive }) => `px-3 py-2 rounded-md font-semibold ${isActive ? "bg-black text-white" : "hover:bg-neutral-100"}`}>
              {l.label}
            </NavLink>
          ))}
          <Link to="/submit" onClick={() => setOpen(false)} data-testid="m-nav-submit">
            <Button className="w-full bg-fuchsia-500 hover:bg-fuchsia-600 text-white border-2 border-black rounded-full font-bold">Submit Post</Button>
          </Link>
          <Link to="/track" onClick={() => setOpen(false)} data-testid="m-nav-track">
            <Button variant="outline" className="w-full border-2 border-black rounded-full font-bold">
              <Search className="w-4 h-4 mr-1.5" strokeWidth={2.5} /> Track submission
            </Button>
          </Link>
          {!user && (
            <Link to="/login" onClick={() => setOpen(false)} data-testid="m-nav-login">
              <Button variant="outline" className="w-full border-2 border-black rounded-full font-bold">Log in</Button>
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
