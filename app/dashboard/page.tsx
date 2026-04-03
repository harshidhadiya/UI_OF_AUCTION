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
    const init = async () => {
      let userData = auth.getUser();

      // If user is missing (e.g. page refresh), try refreshing
      if (!userData) {
        const refreshed = await auth.refreshUser();
        if (!refreshed) {
          router.push('/login');
          return;
        }
        userData = auth.getUser();
      }

      if (!userData || (userData.role !== 'USER' && userData.role !== 'SELLER')) {
        router.push('/login');
        return;
      }
      setUser(userData);
      fetchWatchlist();
    };
    init();

    return () => {
      getAuctionConnection().then(conn => {
        if (!conn) return;
        joinedRoomsRef.current.forEach(id => leaveAuctionRoomSafe(conn, id));
        joinedRoomsRef.current.clear();
      });
    };
  }, []);

  const setupSignalR = async (auctionList: any[]) => {
    const conn = await getAuctionConnection();
    if (!conn) return;

    // Use regular now for SignalR room joining decision
    const todayStr = new Date().toLocaleString('sv-SE').slice(0, 10);
    const toJoin = auctionList.filter(a => {
      const startDate = a.startDate || a.StartDate;
      const status = a.status || a.Status;
      if (status === 'Live') return true;
      if (startDate) return new Date(startDate).toLocaleString('sv-SE').slice(0, 10) === todayStr;
      return false;
    });

    conn.off('AuctionStarted');
    conn.on('AuctionStarted', (data: { auctionId: number }) => {
      const id = String(data.auctionId);
      const matched = auctionList.find(a => String(a.id || a.Id) === id);
      const name = matched?.productName || matched?.ProductName || `Auction #${id}`;
      setAuctionStartedToast({ id, name });
      setTimeout(() => setAuctionStartedToast(null), 8000);
    });

    conn.off('GetWatchListDetail');
    conn.on('GetWatchListDetail', async (data: any) => {
      const incomingId = String(data.id || data.Id || '');
      if (!incomingId) return;

      // Strict filter for dashboard display: only Live or Upcoming within 2 hours (IST)
      const now = new Date();
      const nowIST = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const twoHoursFromNowIST = new Date(nowIST.getTime() + 2 * 60 * 60 * 1000);
      const status = data.status || data.Status;
      const startDateStr = data.startDate || data.StartDate;
      const startDate = startDateStr ? new Date(new Date(startDateStr).toLocaleString("en-US", { timeZone: "Asia/Kolkata" })) : null;

      const shouldBeInDashboard = status === 'Live' || (status === 'Upcoming' && startDate && startDate > nowIST && startDate <= twoHoursFromNowIST);

      setWatchedAuctions(prev => {
        const index = prev.findIndex(a => String(a.id || a.Id) === incomingId);
        if (shouldBeInDashboard) {
          if (index !== -1) {
            // Update existing
            const updatedList = [...prev];
            updatedList[index] = { ...updatedList[index], ...data };
            return updatedList;
          } else {
            // Append new
            return [data, ...prev];
          }
        } else {
          // If not in dashboard window (e.g. Ended), remove if previously added
          if (index !== -1) {
            return prev.filter(a => String(a.id || a.Id) !== incomingId);
          }
          return prev;
        }
      });

      // If auction meets join criteria (Live or Starting in < 2 hrs), ensure connected
      if ((status === 'Live' || (startDate && startDate > nowIST && startDate <= twoHoursFromNowIST))) {
        if (!joinedRoomsRef.current.has(incomingId)) {
          console.log(`[SignalR] Auto-joining auction ${incomingId} (Status: ${status}) [IST Window]`);
          await listenToAuctionSafe(conn, incomingId);
          joinedRoomsRef.current.add(incomingId);
        }
      } else {
        // If it was previously joined but now outside window (e.g. Ended)
        if (joinedRoomsRef.current.has(incomingId)) {
          console.log(`[SignalR] Auto-leaving auction ${incomingId} (Status: ${status}, Outside IST Window)`);
          await leaveAuctionRoomSafe(conn, incomingId);
          joinedRoomsRef.current.delete(incomingId);
        }
      }
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

      const now = new Date();
      const istDate = new Date(now.getTime() + (2 * 60 * 60 * 1000));
      const twoHoursFromNow = istDate.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T');
      const queryParams = new URLSearchParams();
      queryParams.append('size', '200');
      queryParams.append('endDate', twoHoursFromNow);
      queryParams.append("isdashBoardPage", "true");

      const res = await api.get(`/api/Watchlist/watched?${queryParams.toString()}`);
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).items || [];

        // ONLY show Live or Upcoming within 2 hours (IST)
        const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const twoHoursFromNowIST = new Date(nowIST.getTime() + 2 * 60 * 60 * 1000);

        const filteredList = list.filter((a: any) => {
          const status = a.status || a.Status;
          const startDateStr = a.startDate || a.StartDate;
          if (status === 'Live') return true;
          if (status === 'Upcoming' && startDateStr) {
            const startDate = new Date(new Date(startDateStr).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
            return startDate > nowIST && startDate <= twoHoursFromNowIST;
          }
          return false;
        });

        console.log('Filtered Watchlist (Dashboard/IST):', filteredList);
        setWatchedAuctions(filteredList);
        setupSignalR(filteredList);
      } else {
        setWatchedAuctions([]);
        setupSignalR([]);
      }
    } catch {
      setWatchedAuctions([]);
      setupSignalR([]);
    } finally {
      setWatchlistLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-x-hidden pb-12">
      {/* Decorative background Elements */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-accent/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute top-40 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[80px] -translate-x-1/2 pointer-events-none" />

      {/* AuctionStarted global notification (from SignalR) */}
      {auctionStartedToast && (
        <div className="fixed top-24 right-4 md:right-8 z-[999] animate-in fade-in slide-in-from-top-8 duration-500">
          <div className="bg-emerald-600 text-white rounded-[2rem] shadow-2xl shadow-emerald-500/30 border border-emerald-500 p-5 max-w-sm w-full">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-md shadow-inner">
                <svg className="w-6 h-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="font-black text-sm uppercase tracking-widest text-emerald-100 mb-1">Live Now!</p>
                <p className="text-white font-bold text-lg leading-tight line-clamp-2">{auctionStartedToast.name}</p>
                <button
                  onClick={() => { router.push(`/auction/${auctionStartedToast.id}`); setAuctionStartedToast(null); }}
                  className="mt-4 w-full py-2.5 bg-white text-emerald-700 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-50 hover:shadow-lg transition-all active:scale-95"
                >
                  Join Auction →
                </button>
              </div>
              <button onClick={() => setAuctionStartedToast(null)} className="text-white/50 hover:text-white bg-black/10 hover:bg-black/20 rounded-full w-6 h-6 flex items-center justify-center transition-all mt-1">✕</button>
            </div>
          </div>
        </div>
      )}
      
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-32 lg:pt-36 relative z-10">
        
        {/* Hero Section */}
        <div className="bg-white/80 backdrop-blur-md rounded-[2.5rem] p-10 md:p-14 border border-white shadow-xl shadow-slate-200/50 mb-12 flex flex-col md:flex-row md:items-center justify-between gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-brand-accent/5 to-transparent pointer-events-none" />
          
          <div className="relative z-10 w-full max-w-2xl">
            <span className="inline-block py-1.5 px-3 rounded-xl bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest mb-4 border border-slate-200/50">
              User Portal
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter mb-4 leading-tight">
              Welcome back, <br/>
              <span className="text-brand-accent">{user.name}</span>
            </h2>
            <p className="text-slate-500 font-medium text-lg leading-relaxed">
              Start bidding on exclusive items, manage your current sales, or monitor your watchlist directly from here.
            </p>
          </div>
          
          <div className="hidden lg:flex w-32 h-32 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner items-center justify-center relative z-10 transform rotate-3">
             <span className="text-4xl">👋</span>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <DashboardCard
            title="My Auctions"
            count="0"
            desc="Items you are currently selling"
            color="bg-brand-accent"
            href="/auctions"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />}
          />
          <DashboardCard
            title="Active Bids"
            count="0"
            desc="Auctions you are participating in"
            color="bg-slate-900"
            href="/participations"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
          />
          <DashboardCard
            title="Watchlist"
            count={watchlistLoading ? '…' : watchedAuctions.length.toString()}
            desc="Auctions you're keeping an eye on"
            color="bg-amber-500"
            href="/watchlist"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />}
          />
        </div>

        {/* Live Watchlist Section */}
        <div className="bg-white/90 backdrop-blur-md rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/40 overflow-hidden mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-between p-8 border-b border-slate-100/50 bg-slate-50/50">
            <div className="flex items-center gap-4 w-full sm:w-auto mb-4 sm:mb-0">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center shadow-inner border border-amber-100/50">
                <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-xl tracking-tight">Active Watchlist</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Currently Live & Upcoming Soon</p>
              </div>
            </div>
            <Link
              href="/watchlist"
              className="w-full sm:w-auto text-center px-6 py-3 bg-white border border-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest rounded-xl hover:border-amber-500 hover:text-amber-500 hover:shadow-lg hover:shadow-amber-500/10 transition-all active:scale-95"
            >
              View Full List
            </Link>
          </div>

          {watchlistLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-slate-100 border-t-amber-500 rounded-full animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Radar...</p>
            </div>
          ) : watchedAuctions.length === 0 ? (
            <div className="py-24 text-center px-4">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner border border-slate-100">
                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h4 className="text-slate-900 font-black text-lg mb-2">No Active Auctions in Watchlist</h4>
              <p className="text-slate-500 text-sm font-medium mb-8 max-w-md mx-auto">There are currently no items from your watchlist that are live or starting within the next 2 hours.</p>
              <Link href="/auctions" className="inline-flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-900/20 active:scale-95 transition-all">
                Browse Global Catalog 
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </Link>
            </div>
          ) : (
            <div className="p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 bg-slate-50/30">
              {watchedAuctions.slice(0, 8).map((auction: any) => {
                const status = auction.status || auction.Status;
                const statusStyle = statusColors[status] || 'bg-slate-100 text-slate-700 border-slate-200';
                const name = auction.productName || auction.ProductName || 'Unknown Product';
                const desc = auction.productDescription || auction.ProductDescription;
                const startDate = auction.startDate || auction.StartDate;
                const endDate = auction.endDate || auction.EndDate;

                return (
                  <div key={auction.id || auction.Id} className="group bg-white rounded-3xl border border-slate-100 overflow-hidden hover:shadow-2xl hover:shadow-slate-200/60 hover:-translate-y-1 transition-all duration-300 flex flex-col">
                    <div className="p-6 pb-4">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${statusStyle} flex items-center gap-1.5 shadow-sm`}>
                          {status === 'Live' && <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-sm shadow-red-500" />}
                          {status}
                        </div>
                        <button className="text-slate-300 hover:text-red-500 transition-colors">
                           <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                        </button>
                      </div>

                      <h4 className="font-black text-slate-900 text-lg leading-tight line-clamp-1 mb-2 group-hover:text-brand-accent transition-colors">{name}</h4>
                      
                      {desc && (
                        <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-4">
                          {desc}
                        </p>
                      )}

                      {(auction.startingPrice || auction.StartingPrice) > 0 && (
                        <div className="bg-slate-50 rounded-[1rem] p-3 flex justify-between items-center border border-slate-100/50 mt-auto">
                          <span className="text-slate-400 font-bold text-[9px] uppercase tracking-widest">Base Price</span>
                          <span className="font-black text-brand-accent text-sm">₹{(auction.startingPrice || auction.StartingPrice).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-slate-900 px-6 py-4 mt-auto">
                      {status === 'Upcoming' && startDate && (
                        <div className="flex justify-between items-center text-xs text-white/80">
                          <span className="font-bold">Starts in</span>
                          <span className="font-black text-amber-400">{getRelativeDateText(startDate)}</span>
                        </div>
                      )}
                      {status === 'Live' && endDate && (
                        <div className="flex justify-between items-center text-xs text-white">
                          <span className="font-bold flex items-center gap-1.5 text-white/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Live Now
                          </span>
                          <span className="font-black text-emerald-400">Ends {new Date(endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                      {status === 'Ended' && (
                        <div className="text-xs text-slate-400 font-black uppercase tracking-widest text-center">
                          Auction Completed
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {watchedAuctions.length > 8 && (
                <Link
                  href="/watchlist"
                  className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-slate-400 hover:text-brand-accent hover:border-brand-accent/30 hover:bg-white transition-all min-h-[280px] group"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-200 group-hover:bg-brand-light flex items-center justify-center mb-3 transition-colors">
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </div>
                  <span className="font-black text-[10px] uppercase tracking-widest">View {watchedAuctions.length - 8} More</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function DashboardCard({ title, count, desc, color, href, icon }: any) {
  return (
    <Link href={href || '#'} className="block h-full outline-none group">
      <div className="bg-white/90 backdrop-blur-sm p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 hover:shadow-2xl hover:border-slate-200 hover:-translate-y-1 transition-all duration-300 h-full flex flex-col relative overflow-hidden">
        
        {/* Color Accent Bar */}
        <div className={`absolute top-0 left-0 w-full h-1.5 ${color} opacity-80 group-hover:opacity-100 transition-opacity`} />
        
        <div className="flex justify-between items-start mb-6">
          <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center shadow-inner ${color} shadow-lg shadow-black/10 text-white transform group-hover:scale-110 transition-transform`}>
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">{icon}</svg>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-brand-light group-hover:text-brand-accent transition-colors">
            <svg className="w-4 h-4 transform -rotate-45 group-hover:rotate-0 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </div>
        </div>
        
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</h3>
        <p className="text-slate-600 text-sm font-medium mt-1 mb-6 pr-4 leading-relaxed flex-1">{desc}</p>
        
        <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Items</span>
           {/* If we had a count to show we could show it here, but keeping logic consistent */}
           <span className="text-xl font-black text-slate-900">{count}</span>
        </div>
      </div>
    </Link>
  );
}
