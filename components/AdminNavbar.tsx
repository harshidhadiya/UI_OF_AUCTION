'use client';

import { usePathname, useRouter } from 'next/navigation';
import { auth } from '@/lib/auth';

const ADMIN_LINKS = [
  { href: '/admin/dashboard', label: 'Users' },
  { href: '/admin/products', label: 'Products' },
  { href: '/profile', label: 'My Profile' },
];

export default function AdminNavbar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-50 animate-slide-down">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-tight">
          Admin <span className="text-red-500">Dashboard</span>
        </h1>
        <div className="flex gap-4">
          {ADMIN_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <button
                key={link.href}
                onClick={() => router.push(link.href)}
                className={`text-sm font-medium transition-colors ${
                  isActive ? 'font-bold text-red-500 hover:text-red-400' : 'hover:text-red-400'
                }`}
              >
                {link.label}
              </button>
            );
          })}
          <button
            onClick={() => auth.logoutAdmin()}
            className="text-sm font-medium hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
