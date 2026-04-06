'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';
import { BRAND_NAME } from '@/lib/constants';

const ADMIN_LINKS = [
  { href: '/admin/dashboard', label: 'Overview' },
  { href: '/admin/products', label: 'Products' },
  { href: '/profile', label: 'My Profile' },
];

export default function AdminNavbar() {
  const router   = useRouter();
  const pathname = usePathname();
  const [scrolled, setScrolled]     = useState(false);
  const [menuOpen, setMenuOpen]     = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#FAF7F0]/95 backdrop-blur-xl shadow-[0_2px_24px_rgba(0,0,0,0.08)]'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-4">

        {/* Brand */}
        <button
          onClick={() => router.push('/admin/dashboard')}
          className="flex items-center gap-2.5 group shrink-0 bg-transparent border-0"
        >
          <div className="w-9 h-9 bg-[#FFD000] rounded-xl flex items-center justify-center shadow-[0_4px_14px_rgba(255,208,0,0.45)] group-hover:rotate-6 group-hover:scale-105 transition-all duration-300">
            <span className="text-[#111] text-base font-black leading-none">A</span>
          </div>
          <span className="text-[#111] text-lg font-black tracking-tight lowercase hidden sm:block">
            {BRAND_NAME.toLowerCase()} <span className="text-[10px] text-brand-dark bg-[#FFF9D6] border border-[#FFD000]/50 px-1.5 py-0.5 rounded-md ml-1 uppercase tracking-widest align-middle relative -top-0.5">Admin</span>
          </span>
        </button>

        {/* Desktop Nav Pills */}
        <div className="hidden lg:flex items-center gap-0.5 bg-black/5 rounded-2xl p-1.5">
          {ADMIN_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <button
                key={link.href}
                onClick={() => router.push(link.href)}
                className={`px-4 py-2 rounded-xl text-[11px] uppercase font-black tracking-widest transition-all duration-200 ${
                  isActive
                    ? 'bg-[#FFD000] text-[#111] shadow-sm'
                    : 'text-[#6B6557] hover:text-[#111] hover:bg-white/70'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => auth.logoutAdmin()}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-[#111] text-[#111] text-[10px] uppercase font-black tracking-widest hover:bg-[#111] hover:text-[#FAF7F0] transition-all active:scale-95"
          >
            Sign Out
          </button>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden flex flex-col gap-[5px] p-2 rounded-lg hover:bg-black/5 transition-colors"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <span className={`block w-5 h-0.5 bg-[#111] transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
            <span className={`block w-5 h-0.5 bg-[#111] transition-all duration-300 ${menuOpen ? 'opacity-0 w-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-[#111] transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ${
          menuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        } bg-[#FAF7F0] border-t border-[#E5DFD3]`}
      >
        <div className="max-w-7xl mx-auto px-5 py-4 flex flex-col gap-1">
          {ADMIN_LINKS.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <button
                key={link.href}
                onClick={() => { router.push(link.href); setMenuOpen(false); }}
                className={`text-left px-4 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-colors ${
                  isActive ? 'bg-[#FFD000] text-[#111]' : 'text-[#6B6557] hover:bg-black/5'
                }`}
              >
                {link.label}
              </button>
            );
          })}
          <button
            onClick={() => auth.logoutAdmin()}
            className="mt-2 px-4 py-3 rounded-xl bg-[#111] text-[#FAF7F0] text-sm font-black uppercase tracking-widest text-left"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}
