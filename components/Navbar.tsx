'use client';

import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BRAND_NAME } from '@/lib/constants';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/auctions', label: 'Auctions' },
  { href: '/products', label: 'Products' },
  { href: '/participations', label: 'Participations' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/profile', label: 'Profile' },
];


const currentNotShows = ["/participations", "/auctions", "/watchlist"];
export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-50 animate-slide-down">
      <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 group"
        >
          <div className="w-8 h-8 bg-brand-accent rounded-lg flex items-center justify-center shadow-lg shadow-brand-accent/30 group-hover:scale-110 transition-transform">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-lg font-black tracking-tight">{BRAND_NAME}</span>
        </button>

        <div className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            if ("/dashboard" == pathname && currentNotShows.includes(link.href))
              return null;

            const isActive = pathname === link.href;
            return (
              <button
                key={link.href}
                onClick={() => router.push(link.href)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                  ? 'bg-white/10 text-white font-bold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
              >
                {link.label}
              </button>
            );
          })}
          <button
            onClick={() => auth.logoutUser()}
            className="ml-2 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
