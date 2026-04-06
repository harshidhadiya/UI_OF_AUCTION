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
  const [user, setUser]                     = useState<any>(null);
  const [watchedAuctions, setWatchedAuctions] = useState<any[]>([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [auctionStartedToast, setAuctionStartedToast] = useState<{ id: string; name: string } | null>(null);
  const [mounted, setMounted]               = useState(false);
  const joinedRoomsRef                      = useRef<Set<string>>(new Set());
  const router                              = useRouter();

  useEffect(() => {
    setMounted(true);
    const init = async () => {
      let userData = auth.getUser();
      if (!userData) {
        const refreshed = await auth.refreshUser();
        if (!refreshed) { router.push('/login'); return; }
        userData = auth.getUser();
      }
      if (!userData || (userData.role !== 'USER' && userData.role !== 'SELLER')) { router.push('/login'); return; }
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
    const todayStr = new Date().toLocaleString('sv-SE').slice(0, 10);
    const toJoin = auctionList.filter(a => {
      const startDate = a.startDate || a.StartDate;
      const status    = a.status || a.Status;
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
      const now = new Date();
      const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const twoHoursFromNowIST = new Date(nowIST.getTime() + 2 * 60 * 60 * 1000);
      const status = data.status || data.Status;
      const startDateStr = data.startDate || data.StartDate;
      const startDate = startDateStr ? new Date(new Date(startDateStr).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })) : null;
      const shouldBeInDashboard = status === 'Live' || (status === 'Upcoming' && startDate && startDate > nowIST && startDate <= twoHoursFromNowIST);
      setWatchedAuctions(prev => {
        const index = prev.findIndex(a => String(a.id || a.Id) === incomingId);
        if (shouldBeInDashboard) {
          if (index !== -1) { const u = [...prev]; u[index] = { ...u[index], ...data }; return u; }
          else return [data, ...prev];
        } else {
          if (index !== -1) return prev.filter(a => String(a.id || a.Id) !== incomingId);
          return prev;
        }
      });
      if ((status === 'Live' || (startDate && startDate > nowIST && startDate <= twoHoursFromNowIST))) {
        if (!joinedRoomsRef.current.has(incomingId)) {
          await listenToAuctionSafe(conn, incomingId);
          joinedRoomsRef.current.add(incomingId);
        }
      } else {
        if (joinedRoomsRef.current.has(incomingId)) {
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
      queryParams.append('isdashBoardPage', 'true');
      const res = await api.get(`/api/Watchlist/watched?${queryParams.toString()}`);
      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data as any).items || [];
        const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const twoHoursFromNowIST = new Date(nowIST.getTime() + 2 * 60 * 60 * 1000);
        const filteredList = list.filter((a: any) => {
          const status = a.status || a.Status;
          const startDateStr = a.startDate || a.StartDate;
          if (status === 'Live') return true;
          if (status === 'Upcoming' && startDateStr) {
            const startDate = new Date(new Date(startDateStr).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            return startDate > nowIST && startDate <= twoHoursFromNowIST;
          }
          return false;
        });
        setWatchedAuctions(filteredList);
        setupSignalR(filteredList);
      } else { setWatchedAuctions([]); setupSignalR([]); }
    } catch { setWatchedAuctions([]); setupSignalR([]); }
    finally { setWatchlistLoading(false); }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#FAF7F0] relative overflow-x-hidden">
      <div className="yellow-blob" />
      <Navbar />

      {/* AuctionStarted Toast */}
      {auctionStartedToast && (
        <div className="fixed top-24 right-4 md:right-8 z-[999] animate-slide-left pointer-events-auto">
          <div className="w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-[1.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-[#E5DFD3] relative overflow-hidden flex">
            <div className="w-2.5 bg-[#FFD000] shrink-0" />
            <div className="flex-1 p-5 pr-4 flex gap-4">
              <div className="w-12 h-12 bg-[#FAF7F0] rounded-xl flex items-center justify-center border border-[#FFD000]/30 shadow-[0_4px_14px_rgba(255,208,0,0.2)] shrink-0 text-xl">
                🔥
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <p className="font-black text-[10px] uppercase tracking-[0.2em] text-[#6B6557]">Live Now!</p>
                  <button onClick={() => setAuctionStartedToast(null)} className="text-[#B8B0A0] hover:text-[#111] transition-colors -mt-1 -mr-1 p-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
                <p className="text-[#111] font-black text-[15px] leading-snug line-clamp-2 mb-4">{auctionStartedToast.name}</p>
                <button onClick={() => { router.push(`/auction/${auctionStartedToast.id}`); setAuctionStartedToast(null); }} className="w-full py-3 bg-[#FFD000] text-[#111] font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-[#FFC800] transition-colors shadow-sm active:scale-95 flex items-center justify-center gap-2">
                  Join Live Auction →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section - Peddle style */}
      <div className="relative z-10 overflow-hidden min-h-[52vh] flex items-center">
        {/* Yellow blob */}
        <div className="absolute -left-20 top-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FFD000] rounded-[55%_60%_55%_50%/55%_50%_60%_50%] pointer-events-none animate-float-y opacity-90" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-10 pt-24 pb-16 flex flex-col lg:flex-row items-center gap-12 w-full">
          {/* Left text */}
          <div className="flex-1 min-w-0">
            {/* Trust */}
            <div className={`flex items-center gap-2 mb-5 ${mounted ? 'animate-slide-right' : 'opacity-0'}`}>
              <div className="flex text-[#111]">
                {[...Array(5)].map((_, i) => <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>)}
              </div>
              <span className="text-sm font-bold text-[#111]"><span className="font-black">4.8 stars</span> · Trusted by thousands</span>
            </div>

            {/* Headline */}
            {['WELCOME BACK,', user.name.toUpperCase() + '.'].map((line, i) => (
              <div
                key={i}
                className={`display-heading text-[#111] ${mounted ? 'animate-text-reveal' : 'opacity-0'}`}
                style={{ fontSize: 'clamp(2.4rem, 4.5vw, 5rem)', animationDelay: `${i * 100}ms` }}
              >
                {line}
              </div>
            ))}
            <p className={`mt-5 text-[#6B6557] text-base font-medium max-w-lg leading-relaxed ${mounted ? 'animate-slide-up animate-delay-3' : 'opacity-0'}`}>
              Start bidding on exclusive items, manage your current sales, or monitor your watchlist.
            </p>
          </div>

          {/* Right quick-launch */}
          <div className={`w-full lg:w-80 shrink-0 ${mounted ? 'animate-slide-left animate-delay-2' : 'opacity-0'}`}>
            <div className="bg-white rounded-3xl p-6 shadow-[0_8px_40px_rgba(0,0,0,0.10)] border border-[#E5DFD3]">
              <p className="text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-4">Quick Access</p>
              <div className="space-y-3">
                {[
                  { label: 'Browse Auctions', href: '/auctions', icon: '🔨', yellow: true },
                  { label: 'My Products', href: '/products', icon: '📦', yellow: false },
                  { label: 'My Watchlist', href: '/watchlist', icon: '👁', yellow: false },
                  { label: 'My Profile', href: '/profile', icon: '👤', yellow: false },
                ].map(({ label, href, icon, yellow }) => (
                  <Link key={href} href={href} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-black text-sm transition-all hover:-translate-y-0.5 ${yellow ? 'bg-[#FFD000] text-[#111] shadow-[0_4px_14px_rgba(255,208,0,0.4)]' : 'bg-[#FAF7F0] text-[#111] hover:bg-[#F0EBE0]'}`}>
                    <span className="text-lg">{icon}</span>
                    {label}
                    <svg className="w-4 h-4 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={`relative z-10 max-w-7xl mx-auto px-6 md:px-10 -mt-4 mb-10 grid grid-cols-1 md:grid-cols-3 gap-5 ${mounted ? 'animate-slide-up animate-delay-4' : 'opacity-0'}`}>
        <DashboardCard title="My Auctions" desc="Items you're currently selling" href="/auctions" icon="🔨" accentColor="#FFD000" />
        <DashboardCard title="Active Bids" desc="Auctions you're participating in" href="/participations" icon="💰" accentColor="#111" dark />
        <DashboardCard title="Watchlist" desc="Auctions coming soon" href="/watchlist" icon="👁" accentColor="#E5DFD3" count={watchlistLoading ? '…' : watchedAuctions.length.toString()} />
      </div>

      {/* Live Watchlist */}
      <div className={`relative z-10 max-w-7xl mx-auto px-6 md:px-10 pb-16 ${mounted ? 'animate-slide-up animate-delay-5' : 'opacity-0'}`}>
        <div className="bg-white rounded-3xl border border-[#E5DFD3] shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-8 py-6 border-b border-[#F0EBE0] bg-[#FAF7F0]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFD000] rounded-xl flex items-center justify-center shadow-[0_3px_10px_rgba(255,208,0,0.4)]">
                <span className="text-lg">👁</span>
              </div>
              <div>
                <h3 className="font-black text-[#111] text-lg tracking-tight">Active Watchlist</h3>
                <p className="text-[10px] text-[#6B6557] font-black uppercase tracking-widest">Live & Upcoming Soon</p>
              </div>
            </div>
            <Link href="/watchlist" className="px-5 py-2.5 bg-white border-2 border-[#111] text-[#111] font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[#111] hover:text-[#FAF7F0] transition-all active:scale-95">
              View All
            </Link>
          </div>

          {/* Content */}
          {watchlistLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-10 h-10 border-4 border-[#E5DFD3] border-t-[#FFD000] rounded-full animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-widest text-[#B8B0A0]">Loading Watchlist...</p>
            </div>
          ) : watchedAuctions.length === 0 ? (
            <div className="py-20 text-center px-4">
              <div className="w-20 h-20 bg-[#FAF7F0] rounded-3xl flex items-center justify-center mx-auto mb-6 border border-[#E5DFD3]">
                <span className="text-4xl">👁</span>
              </div>
              <h4 className="text-[#111] font-black text-xl mb-2">No Active Auctions in Watchlist</h4>
              <p className="text-[#6B6557] text-sm font-medium mb-8 max-w-sm mx-auto">No items from your watchlist are live or starting within the next 2 hours.</p>
              <Link href="/auctions" className="inline-flex items-center gap-2 cta-button px-8 text-sm">
                Browse Auctions <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </Link>
            </div>
          ) : (
            <div className="p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {watchedAuctions.slice(0, 8).map((auction: any) => {
                const status     = auction.status || auction.Status;
                const statusStyle = statusColors[status] || 'bg-[#F1F0ED] text-[#6B6557] border-[#E5DFD3]';
                const name       = auction.productName || auction.ProductName || 'Unknown Product';
                const startDate  = auction.startDate || auction.StartDate;
                const endDate    = auction.endDate   || auction.EndDate;
                return (
                  <div key={auction.id || auction.Id} className="group bg-white rounded-2xl border border-[#E5DFD3] overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
                    <div className="p-5 flex-1">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border mb-3 ${statusStyle}`}>
                        {status === 'Live' && <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                        {status}
                      </div>
                      <h4 className="font-black text-[#111] text-base line-clamp-1 mb-1 group-hover:text-[#FFD000] transition-colors">{name}</h4>
                      {(auction.startingPrice || auction.StartingPrice) > 0 && (
                        <div className="flex items-center justify-between mt-3 bg-[#FAF7F0] rounded-xl px-3 py-2">
                          <span className="text-[9px] font-black text-[#B8B0A0] uppercase tracking-widest">Base</span>
                          <span className="font-black text-[#111] text-sm">₹{(auction.startingPrice || auction.StartingPrice).toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-[#111] px-5 py-3">
                      {status === 'Upcoming' && startDate && (
                        <div className="flex justify-between items-center text-xs text-white/70">
                          <span>Starts in</span>
                          <span className="font-black text-[#FFD000]">{getRelativeDateText(startDate)}</span>
                        </div>
                      )}
                      {status === 'Live' && endDate && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="flex items-center gap-1.5 text-white/70"><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />Live Now</span>
                          <span className="font-black text-emerald-400">Ends {new Date(endDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {watchedAuctions.length > 8 && (
                <Link href="/watchlist" className="bg-[#FAF7F0] border-2 border-dashed border-[#E5DFD3] rounded-2xl flex flex-col items-center justify-center text-[#B8B0A0] hover:text-[#111] hover:border-[#FFD000] hover:bg-white transition-all min-h-[180px] group">
                  <span className="text-2xl mb-2">+</span>
                  <span className="font-black text-[10px] uppercase tracking-widest">{watchedAuctions.length - 8} More</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DashboardCard({ title, desc, href, icon, accentColor, dark, count }: any) {
  return (
    <Link href={href} className="block group">
      <div className={`rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative overflow-hidden ${dark ? 'bg-[#111] border-transparent text-white' : 'bg-white border-[#E5DFD3]'}`}>
        <div className="absolute top-0 left-0 w-full h-1" style={{ background: accentColor }} />
        <div className="flex items-start justify-between mb-5">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl" style={{ background: accentColor + '20' }}>
            {icon}
          </div>
          <svg className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${dark ? 'text-white/40' : 'text-[#B8B0A0]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </div>
        <h3 className={`text-[10px] font-black uppercase tracking-widest mb-1 ${dark ? 'text-white/50' : 'text-[#B8B0A0]'}`}>{title}</h3>
        <p className={`text-sm font-medium leading-snug ${dark ? 'text-white/70' : 'text-[#6B6557]'}`}>{desc}</p>
        {count !== undefined && (
          <div className={`mt-4 pt-4 border-t flex items-center justify-between ${dark ? 'border-white/10' : 'border-[#F0EBE0]'}`}>
            <span className={`text-[10px] font-black uppercase tracking-widest ${dark ? 'text-white/30' : 'text-[#B8B0A0]'}`}>Active</span>
            <span className={`text-xl font-black ${dark ? 'text-white' : 'text-[#111]'}`}>{count}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
