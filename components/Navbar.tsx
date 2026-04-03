'use client';

import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BRAND_NAME } from '@/lib/constants';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/auctions', label: 'Auctions' },
  { href: '/products', label: 'Products' },
  { href: '/participations', label: 'Participation' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/profile', label: 'Profile' },
];

const currentNotShows = ["/participations", "/auctions", "/watchlist"];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="fixed top-4 left-0 right-0 w-full z-50 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none px-4 md:px-8">
      <div className="max-w-7xl mx-auto bg-white/80 backdrop-blur-xl border border-white/50 shadow-2xl shadow-slate-200/40 rounded-[2.5rem] pl-4 pr-6 py-3 flex justify-between items-center transition-all hover:bg-white/95 pointer-events-auto">

        {/* Brand Area */}
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-3 group active:scale-95 transition-all"
        >
          <div className="w-10 h-10 bg-brand-accent rounded-2xl flex items-center justify-center shadow-lg shadow-brand-accent/20 group-hover:rotate-6 group-hover:scale-105 transition-all duration-300">
            <span className="text-white text-[1.1rem] font-black leading-none mt-0.5">A</span>
          </div>
          <span className="text-xl font-black text-slate-900 tracking-tighter hidden sm:block">{BRAND_NAME}</span>
        </button>

        {/* Navigation Core */}
        <div className="hidden lg:flex items-center gap-1.5 p-1.5 bg-slate-50/80 rounded-[1.5rem] border border-slate-100/50 shadow-inner">
          {NAV_LINKS.map((link) => {
            if ("/dashboard" === pathname && currentNotShows.includes(link.href))
              return null;

            const isActive = pathname.startsWith(link.href);
            return (
              <button
                key={link.href}
                onClick={() => router.push(link.href)}
                className={`px-4 py-2.5 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 ${isActive
                  ? 'bg-white text-brand-accent shadow-sm scale-100'
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100/50 scale-95 hover:scale-100'
                  }`}
              >
                {link.label}
              </button>
            );
          })}
        </div>

        {/* Right Action Area */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => auth.logoutUser()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-red-50 text-red-500 text-[10px] uppercase font-black tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95"
          >
            <span className="hidden sm:inline">Terminate</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
