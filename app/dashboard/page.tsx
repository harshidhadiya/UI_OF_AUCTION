'use client';
import { useEffect, useState, useRef } from 'react';
import { auth } from '@/lib/auth';
import { api } from '@/lib/api';
import { getAuctionConnection, listenToAuctionSafe, leaveAuctionRoomSafe } from '@/lib/auctionSignalR';
import { statusColors } from '@/lib/constants';
import { getRelativeDateText } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function UserDashboard() {
  const [user, setUser] = useState<any>(null);
  const [watchedAuctions, setWatchedAuctions] = useState<any[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [auctionStartedToast, setAuctionStartedToast] = useState<{ id: string; name: string } | null>(null);
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    const userData = auth.getUser();
    if (!userData || (userData.role !== 'USER' && userData.role !== 'SELLER')) {
      router.push('/login');
      return;
    }
    setUser(userData);
    fetchWatchlist();
    return () => {
      getAuctionConnection(auth.getToken()!).then(conn => {
        if (!conn) return;
        joinedRoomsRef.current.forEach(id => leaveAuctionRoomSafe(conn, id));
        joinedRoomsRef.current.clear();
      });
    };
  }, []);

  const setupSignalR = async (auctionList: any[]) => {
    const token = auth.getToken();
    if (!token) return;
    const todayStr = new Date().toLocaleString('sv-SE').slice(0, 10);
    const toJoin = auctionList.filter(a => {
      const startDate = a.startDate || a.StartDate;
      const status = a.status || a.Status;
      if (status === 'Live') return true;
      if (startDate) return new Date(startDate).toLocaleString('sv-SE').slice(0, 10) === todayStr;
      return false;
    });
    if (toJoin.length === 0) return;
    const conn = await getAuctionConnection(token);
    if (!conn) return;

    conn.off('AuctionStarted');
    conn.on('AuctionStarted', (data: { auctionId: number }) => {
      const id = String(data.auctionId);
      const matched = auctionList.find(a => String(a.id || a.Id) === id);
      const name = matched?.productName || matched?.ProductName || `Auction #${id}`;
      setAuctionStartedToast({ id, name });
      setTimeout(() => setAuctionStartedToast(null), 8000);
    });

    for (const auction of toJoin) {
      const auctionId = String(auction.id || auction.Id);
      if (joinedRoomsRef.current.has(auctionId)) continue;
      await listenToAuctionSafe(conn, auctionId);
      joinedRoomsRef.current.add(auctionId);
    }
  };

  const fetchWatchlist = async () => {


    try {
      setWatchlistLoading(true);
      const token = auth.getToken();
      const res = await api.get('/api/Watchlist/watched', token!);
      if (res.success && res.data) {
        const list = res.data as any[];
        setWatchedAuctions(list);
        setupSignalR(list);
      } else {
        setWatchedAuctions([]);
      }
    } catch {
      setWatchedAuctions([]);
    } finally {
      setWatchlistLoading(false);
    }
  };

  if (!user) return null;



  return (
    <div className="min-h-screen bg-slate-50 page-enter">
      {/* AuctionStarted global notification (from SignalR) */}
      {auctionStartedToast && (
        <div className="fixed top-6 right-6 z-[999] animate-slide-down">
          <div className="bg-emerald-600 text-white rounded-2xl shadow-2xl border border-emerald-500 p-5 max-w-xs">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm">Auction is LIVE! 🚀</p>
                <p className="text-emerald-100 text-xs mt-0.5 line-clamp-1">{auctionStartedToast.name}</p>
                <button
                  onClick={() => { router.push(`/auction/${auctionStartedToast.id}`); setAuctionStartedToast(null); }}
                  className="mt-3 w-full py-2 bg-white text-emerald-700 font-black text-xs rounded-xl hover:bg-emerald-50 transition-all"
                >
                  Participate Now →
                </button>
              </div>
              <button onClick={() => setAuctionStartedToast(null)} className="text-white/60 hover:text-white text-sm">✕</button>
            </div>
          </div>
        </div>
      )}
      <Navbar />

      <main className="max-w-7xl mx-auto p-8">
        <div className="bg-gradient-to-r from-brand-accent/10 to-transparent p-12 rounded-[2rem] border border-brand-accent/5 mb-12">
          <h2 className="text-4xl font-extrabold text-slate-900 mb-4">Welcome back, {user.name}!</h2>
          <p className="text-lg text-slate-500 max-w-2xl">Start bidding on exclusive items or manage your auctions directly from this dashboard.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <DashboardCard
            title="My Auctions"
            count="0"
            desc="Items you are currently selling"
            color="bg-blue-500"
            href="/my-auctions"
          />
          <DashboardCard
            title="Active Bids"
            count="0"
            desc="Auctions you are participating in"
            color="bg-emerald-500"
            href="/participations"
          />
          <DashboardCard
            title="Watchlist"
            count={watchlistLoading ? '…' : watchedAuctions.length.toString()}
            desc="Auctions you're keeping an eye on"
            color="bg-amber-500"
            href="/watchlist"
          />
        </div>

        {/* My Watchlist — inline */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-8">
          <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">My Watchlist</h3>
                <p className="text-slate-400 text-xs font-medium">Auctions you're tracking</p>
              </div>
            </div>
            <Link
              href="/watchlist"
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white font-bold text-sm rounded-xl hover:bg-amber-600 transition-all shadow-md shadow-amber-500/20"
            >
              View All
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {watchlistLoading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 font-medium text-sm">Loading watchlist…</p>
            </div>
          ) : watchedAuctions.length === 0 ? (
            <div className="px-8 py-14 text-center">
              <svg className="w-12 h-12 text-slate-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <p className="text-slate-400 text-sm font-medium mb-4">Your watchlist is empty. Browse auctions to start watching.</p>
              <Link href="/auctions" className="text-amber-500 font-bold text-sm hover:underline">Browse Auctions →</Link>
            </div>
          ) : (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {watchedAuctions.slice(0, 8).map((auction: any) => {
                const status = auction.status || auction.Status;
                const statusStyle = statusColors[status] || 'bg-slate-100 text-slate-700 border-slate-200';
                const name = auction.productName || auction.ProductName || 'Unknown Product';
                const desc = auction.productDescription || auction.ProductDescription;
                const startDate = auction.startDate || auction.StartDate;
                const endDate = auction.endDate || auction.EndDate;

                return (
                  <div key={auction.id || auction.Id} className="bg-slate-50 rounded-2xl border border-slate-100 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                      <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusStyle}`}>
                        <span className="flex items-center gap-1">
                          {status === 'Live' && <span className="w-1.5 h-1.5 bg-red-600 rounded-full inline-block animate-pulse" />}
                          {status}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-black text-slate-900 text-sm line-clamp-1 mb-1">{name}</h4>
                      {desc && (
                        <ul className="space-y-0.5">
                          {desc.split(',').filter((p: string) => p.trim()).slice(0, 2).map((point: string, idx: number) => (
                            <li key={idx} className="flex gap-1.5 items-start text-xs text-slate-500">
                              <span className="text-amber-500 font-bold mt-0.5">•</span>
                              <span className="line-clamp-1">{point.trim()}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {(auction.startingPrice || auction.StartingPrice) > 0 && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-bold uppercase tracking-widest">Starting</span>
                        <span className="font-bold text-slate-700">₹{(auction.startingPrice || auction.StartingPrice).toLocaleString()}</span>
                      </div>
                    )}

                    <div className="text-xs text-slate-500 font-medium mt-auto">
                      {status === 'Upcoming' && startDate && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          Starts: <span className="font-bold text-amber-500">{getRelativeDateText(startDate)}</span> at {new Date(startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {status === 'Live' && endDate && (
                        <span className="flex items-center gap-1 text-red-500 font-bold">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Live — ends {new Date(endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {status === 'Ended' && (
                        <span className="text-slate-400">Auction ended</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {watchedAuctions.length > 8 && (
                <Link
                  href="/watchlist"
                  className="flex items-center justify-center bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl text-amber-500 font-bold text-sm hover:bg-amber-100 transition-colors min-h-[120px]"
                >
                  +{watchedAuctions.length - 8} more →
                </Link>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DashboardCard({ title, count, desc, color, href }: any) {
  return (
    <Link href={href || '#'} className="block">
      <div className="premium-card p-8 group hover:border-brand-accent/20 transition-all cursor-pointer card-hover">
        <div className={`w-12 h-1 outline outline-4 outline-white rounded-full ${color} mb-6`} />
        <h3 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">{title}</h3>
        <div className="text-4xl font-extrabold text-slate-900 mb-2">{count}</div>
        <p className="text-sm text-slate-500">{desc}</p>
        <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-brand-accent opacity-0 group-hover:opacity-100 transition-opacity">
          View <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </div>
      </div>
    </Link>
  );
}
