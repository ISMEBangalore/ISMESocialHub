import Header from "@/components/Header";
import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";

export default function Layout() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAFAFA] text-neutral-900">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <Outlet />
      </main>
      <footer className="border-t-2 border-black bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
          <img src="/isme-logo.png" alt="ISME Bangalore — Celebrating 20 Years" className="h-8 sm:h-9 w-auto object-contain" />
          <div className="text-neutral-500">Built for clubs, students & faculty · Internal Tool</div>
        </div>
      </footer>
      <Toaster position="top-right" richColors closeButton offset={{ top: "80px" }} />
    </div>
  );
}
