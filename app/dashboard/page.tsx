'use client';
import { useEffect, useState } from 'react';
import { auth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function UserDashboard() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const userData = auth.getUser();
    console.log(userData.role);
    if (!userData || (userData.role !== 'USER' && userData.role !== 'SELLER')) {
      console.log("user not found");
      router.push('/login');
      return;
    }
    setUser(userData);
  }, []);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-brand-accent tracking-tighter">Auction<span className="text-slate-900">Central</span></h1>
          <div className="flex items-center gap-6">
            <Link href="/products" className="text-sm font-semibold text-slate-600 hover:text-brand-accent transition-colors">Products Hub</Link>
            <Link href="/auctions" className="text-sm font-semibold text-slate-600 hover:text-brand-accent transition-colors">Auctions</Link>
            <Link href="/profile" className="text-sm font-semibold text-slate-600 hover:text-brand-accent transition-colors">Profile</Link>
            <button onClick={() => auth.logout()} className="premium-button bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs">Sign Out</button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8">
        <div className="bg-gradient-to-r from-brand-accent/10 to-transparent p-12 rounded-[2rem] border border-brand-accent/5 mb-12">
          <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Welcome back, {user.name}!</h2>
          <p className="text-lg text-slate-500 max-w-2xl">Start bidding on exclusive items or manage your auctions directly from this dashboard.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <DashboardCard
            title="My Auctions"
            count="0"
            desc="Items you are currently selling"
            color="bg-blue-500"
          />
          <DashboardCard
            title="Active Bids"
            count="0"
            desc="Auctions you are participating in"
            color="bg-emerald-500"
          />
          <DashboardCard
            title="Watchlist"
            count="0"
            desc="Items you're keeping an eye on"
            color="bg-amber-500"
          />
        </div>

        <div className="mt-16 bg-white rounded-3xl p-12 border border-slate-100 shadow-sm text-center">
          <div className="w-24 h-24 bg-brand-light rounded-full flex items-center justify-center mx-auto mb-6 transition-transform hover:scale-110">
            <svg className="w-12 h-12 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 6v6m0 0v6m0-6h6m-6 0H6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Ready to sell?</h3>
          <p className="text-slate-400 max-w-sm mx-auto mb-6">Head over to the Products Hub to upload your premium items and manage verification.</p>
          <Link href="/products" className="premium-button bg-brand-accent text-white shadow-xl shadow-brand-accent/20 px-8 py-4">
            Go to Products Hub
          </Link>
        </div>
      </main>
    </div>
  );
}

function DashboardCard({ title, count, desc, color }: any) {
  return (
    <div className="premium-card p-8 group hover:border-brand-accent/20 transition-all">
      <div className={`w-12 h-1 outline outline-4 outline-white rounded-full ${color} mb-6`} />
      <h3 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">{title}</h3>
      <div className="text-4xl font-extrabold text-slate-900 mb-2">{count}</div>
      <p className="text-sm text-slate-500">{desc}</p>
    </div>
  );
}
