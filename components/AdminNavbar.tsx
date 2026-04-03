'use client';

import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';

const ADMIN_LINKS = [
  { href: '/admin/dashboard', label: 'Overview' },
  { href: '/admin/products', label: 'Products' },
  { href: '/profile', label: 'My Profile' },
];

export default function AdminNavbar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="fixed top-4 left-0 right-0 w-full z-50 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-none px-4 md:px-8">
      <div className="max-w-7xl mx-auto bg-slate-900/90 backdrop-blur-xl border border-white/10 shadow-2xl shadow-brand-accent/20 rounded-[2.5rem] pl-4 pr-6 py-3 flex justify-between items-center transition-all hover:bg-slate-900 pointer-events-auto">

        {/* Brand Area */}
        <button
          onClick={() => router.push('/admin/dashboard')}
          className="flex items-center gap-3 group active:scale-95 transition-all"
        >
          <div className="w-10 h-10 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:-rotate-6 group-hover:scale-105 transition-all duration-300">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-xl font-black tracking-tight text-white hidden sm:block">
            ADMIN <span className="text-red-500 rounded-lg bg-red-500/10 px-2 py-0.5 ml-1 text-sm tracking-widest align-middle">CORE</span>
          </h1>
        </button>

        {/* Navigation Core */}
        <div className="hidden lg:flex items-center gap-1.5 p-1.5 bg-slate-800/50 rounded-[1.5rem] border border-slate-700/50">
          {ADMIN_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <button
                key={link.href}
                onClick={() => router.push(link.href)}
                className={`px-4 py-2.5 rounded-xl text-[10px] uppercase font-black tracking-widest transition-all duration-300 ${isActive
                  ? 'bg-red-600 text-white shadow-sm scale-100'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 scale-95 hover:scale-100'
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
            onClick={() => auth.logoutAdmin()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-800 text-slate-300 text-[10px] uppercase font-black tracking-widest hover:bg-red-600 hover:text-white transition-all active:scale-95"
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
