'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAuctionConnection, listenToAuctionSafe, leaveAuctionRoomSafe } from '@/lib/auctionSignalR';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function ParticipationsPage() {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Filters
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [winOnly, setWinOnly] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState(false);

  // Modals & UI
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({});
  const [auctionRtData, setAuctionRtData] = useState<Record<string, any>>({});
  const joinedRoomsRef = useRef<Set<string>>(new Set());

  const currentUser = auth.getUser();
  const router = useRouter();
  const showToast = (msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const updateAuctionRt = (auctionId: string, patch: Record<string, any>) => {
    setAuctionRtData(prev => ({
      ...prev,
      [auctionId]: { ...(prev[auctionId] || {}), ...patch }
    }));
  };

  const fetchParticipations = async (isLoadMore = false) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('Page', page.toString());
      params.append('PageSize', '20');
      if (name) params.append('name', name);
      if (status) params.append('Status', status);
      if (minPrice) params.append('MinPrice', minPrice);
      if (maxPrice) params.append('MaxPrice', maxPrice);
      if (startDate) params.append('FilterStartDate', startDate);
      if (endDate) params.append('FilterEndDate', endDate);
      if (winOnly) params.append('win', 'true');

      const res = await api.get(`/api/auctions/participated?${params.toString()}`);
      console.log(res)
      if (res.success && res.data) {
        console.log(res.data.items)
        const data = res.data as any;
        const items = data.items || [];
        setHasMore(items.length === 20);
        setAuctions(prev => isLoadMore ? [...prev, ...items] : items);
        setupSignalR(items);
      } else {
        if (!isLoadMore) setAuctions([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
      if (!isLoadMore) setAuctions([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => { if (page !== 1) setPage(1); setSearchTrigger(p => !p); };
  const handleClear = () => {
    setName(''); setStatus(''); setMinPrice(''); setMaxPrice(''); setStartDate(''); setEndDate('');
    setWinOnly(false);
    if (page !== 1) setPage(1); setSearchTrigger(p => !p);
  };

  const handleViewProduct = async (auction: any) => {
    try {
      const res = await api.post('/api/Product/all', { productId: auction.productId || auction.ProductId }, false);
      if (res.success && res.data) {
        const productsArray = res.data as any[];
        if (productsArray.length > 0) {
          const fullProduct = productsArray[0];
          setSelectedProduct({
            ...fullProduct,
            auctionPrice: auction.currentHighestBid || auction.CurrentHighestBid || auction.startingPrice || auction.StartingPrice
          });
          setIsProductModalOpen(true);
        }
      }
    } catch (err) {
      console.error("Failed to fetch product details", err);
      showToast("Failed to load product details", "error");
    }
  };

  useEffect(() => {
    const init = async () => {
      let user = auth.getUser();

      if (!user) {
        const refreshed = await auth.refreshUser();
        if (!refreshed) {
          router.push('/login');
          return;
        }
        user = auth.getUser();
      }

      if (!user) { router.push('/login'); return; }
      fetchParticipations(page > 1);
    };
    init();
  }, [page, searchTrigger, status]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          setPage(p => p + 1);
        }
      },
      { threshold: 0.1 }
    );
    const currentTarget = observerTarget.current;
    if (currentTarget) observer.observe(currentTarget);
    return () => { if (currentTarget) observer.unobserve(currentTarget); };
  }, [loading, hasMore]);

  // SignalR cleanup on unmount
  useEffect(() => {
    return () => {
      getAuctionConnection().then(conn => {
        if (!conn) return;
        joinedRoomsRef.current.forEach(id => leaveAuctionRoomSafe(conn, id));
        joinedRoomsRef.current.clear();
      });
    };
  }, []);

  const setupSignalR = useCallback(async (auctionList: any[]) => {
    const user = auth.getUser();
    if (!user) return;

    const todayStr = new Date().toLocaleString('sv-SE').slice(0, 10);
    const toJoin = auctionList.filter(a => {
      const s = a.status || a.Status;
      const sd = a.startDate || a.StartDate;
      if (s === 'Live') return true;
      if (sd && new Date(sd).toLocaleString('sv-SE').slice(0, 10) === todayStr) return true;
      return false;
    });

    if (toJoin.length === 0) return;
    const conn = await getAuctionConnection();
    if (!conn) return;

    // Handlers
    conn.off('ViewerCountUpdated');
    conn.on('ViewerCountUpdated', (count: number) => {
      joinedRoomsRef.current.forEach(id => setViewerCounts(prev => ({ ...prev, [id]: count })));
    });

    conn.off('BidPlaced');
    conn.on('BidPlaced', (data: any) => {
      const id = String(data.auctionId ?? '');
      if (id) updateAuctionRt(id, { lastBid: data, currentHighestBid: data.amount });
      setAuctions(prev => prev.map(a => String(a.id || a.Id) === id ? { ...a, currentHighestBid: data.amount, endDate: data.newEndDate ?? (a.endDate || a.EndDate) } : a));
    });

    conn.off('TimerTick');
    conn.on('TimerTick', (data: any) => updateAuctionRt(String(data.auctionId), { secondsRemaining: data.secondsRemaining }));

    conn.off('AuctionStarted');
    conn.on('AuctionStarted', (data: any) => {
      const id = String(data.auctionId);
      setAuctions(prev => prev.map(a => String(a.id || a.Id) === id ? { ...a, status: 'Live', Status: 'Live' } : a));
      showToast(`🚀 Auction #${id} has STARTED!`, 'success');
    });

    conn.off('AuctionClosed');
    conn.on('AuctionClosed', (data: any) => {
      const id = String(data.auctionId);
      setAuctions(prev => prev.map(a => String(a.id || a.Id) === id ? { ...a, status: 'Ended', Status: 'Ended' } : a));
      updateAuctionRt(id, { closed: true, winner: data });
      showToast(`🏁 Auction #${id} ended!`, 'info');
    });

    for (const a of toJoin) {
      const id = String(a.id || a.Id);
      if (!joinedRoomsRef.current.has(id)) {
        await listenToAuctionSafe(conn, id);
        joinedRoomsRef.current.add(id);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-brand-light relative overflow-x-hidden pb-12">
      {/* Decorative background Elements */}
      <div className="yellow-blob" />
      <div className="absolute top-40 left-0 w-[400px] h-[400px] bg-brand-accent/10 rounded-full blur-[80px] -translate-x-1/2 pointer-events-none" />

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[999] px-5 py-4 rounded-2xl shadow-2xl font-semibold text-sm animate-slide-down border text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <Navbar />

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-32 lg:pt-36 relative z-10">
        <header className="mb-10 flex flex-col gap-1">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-[#FFD000] rounded-full" />
            <span className="text-[10px] font-black text-[#6B6557] uppercase tracking-widest">Activity History</span>
          </div>
          <h2 className="display-heading text-[#111]" style={{ fontSize: 'clamp(2.6rem,5vw,5rem)' }}>
            PARTICIPATIONS.
          </h2>
          <p className="text-[#6B6557] font-medium mt-2 max-w-lg">Manage and track auctions you have placed bids on.</p>
        </header>

        {/* Filters Panel */}
        <div className="bg-white border border-[#E5DFD3] rounded-2xl p-5 mb-8 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">  
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-1.5">Search</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Product name..." className="w-full px-4 py-3 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl focus:border-[#FFD000] focus:ring-4 focus:ring-[#FFD000]/10 outline-none transition-all text-sm text-[#111] font-medium" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-1.5">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-4 py-3 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl focus:border-[#FFD000] outline-none text-sm text-[#111] font-medium">
                <option value="">All Statuses</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Live">Live</option>
                <option value="Ended">Ended</option>
              </select>
            </div>
            <div className="flex-1 flex gap-3 min-w-[280px]">
              <div className="flex-1">
                <label className="block text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-1.5">Min Price</label>
                <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="Min ₹" className="w-full px-4 py-3 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl focus:border-[#FFD000] outline-none text-sm text-[#111] font-medium" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-1.5">Max Price</label>
                <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Max ₹" className="w-full px-4 py-3 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl focus:border-[#FFD000] outline-none text-sm text-[#111] font-medium" />
              </div>
            </div>
            <div className="flex-1 flex gap-3 min-w-[280px]">
              <div className="flex-1">
                <label className="block text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-1.5">Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-3 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl focus:border-[#FFD000] outline-none text-sm text-[#111] font-medium" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-1.5">End Date</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-3 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl focus:border-[#FFD000] outline-none text-sm text-[#111] font-medium" />
              </div>
            </div>

            <div className="flex flex-col justify-end shrink-0">
              <span className="block text-[10px] text-transparent mb-1.5" aria-hidden="true">&nbsp;</span>
              <div className="flex items-center gap-2.5 h-[48px] px-1">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={winOnly} onChange={e => { setWinOnly(e.target.checked); if (page !== 1) setPage(1); setSearchTrigger(p => !p); }} />
                  <div className="w-10 h-5 bg-[#E5DFD3] rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FFD000]"></div>
                </label>
                <span className="text-[10px] font-black text-[#6B6557] uppercase tracking-widest whitespace-nowrap">Won Only</span>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <button onClick={handleClear} className="px-5 py-3 bg-[#FAF7F0] border-2 border-[#E5DFD3] text-[#6B6557] font-black text-xs uppercase tracking-widest rounded-xl hover:border-[#111] hover:text-[#111] transition-all">Clear</button>
              <button onClick={handleSearch} className="cta-button px-6 py-3 h-auto text-xs">Search</button>
            </div>
          </div>
        </div>

        {loading && auctions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white/50 backdrop-blur-md rounded-[3rem] shadow-sm border border-slate-100/50">
            <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mb-6" />
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400">Loading your participations...</p>
          </div>
        ) : auctions.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-sm rounded-[3rem] p-24 text-center shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-inner border border-slate-100">
              <svg className="w-12 h-12 text-brand-accent/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">No Participations Found</h3>
            <p className="text-slate-500 font-medium text-lg max-w-sm mb-8">You haven't placed any bids that match these filters.</p>
            <Link href="/auctions" className="px-10 py-4 bg-brand-accent text-white font-black text-[10px] uppercase tracking-widest rounded-[1.5rem] shadow-xl shadow-brand-accent/20 hover:bg-brand-dark transition-all active:scale-95 inline-block">
              Browse Auctions
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {auctions.map((a: any) => (
                <ParticipationCard
                  key={a.id || a.Id}
                  auction={a}
                  viewerCount={viewerCounts[String(a.id || a.Id)]}
                  rtData={auctionRtData[String(a.id || a.Id)]}
                  onViewDetails={() => handleViewProduct(a)}
                  win={a.win}
                />
              ))}
            </div>
            {hasMore ? (
              <div ref={observerTarget} className="flex justify-center py-12">
                {loading && <div className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400 font-bold uppercase tracking-widest text-xs">End of list</div>
            )}
          </>
        )}

        {/* Product Details Modal (Premium Alignment) */}
        <ProductDetailsModal
          isOpen={isProductModalOpen}
          product={selectedProduct}
          onClose={() => setIsProductModalOpen(false)}
          currentUser={currentUser}
        />
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────────────────────────────────────

function ParticipationCard({ auction, viewerCount, rtData, onViewDetails, win }: { auction: any, viewerCount?: number, rtData?: any, onViewDetails: () => void, win: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isWatched, setIsWatched] = useState(true); // Since it's in Participations, it's effectively watched/joined
  const router = useRouter();
  const currentUser = auth.getUser();
  const id = auction.id || auction.Id;

  const isMine = auction.createdByUserId == currentUser?.id || auction.CreatedByUserId == currentUser?.id;

  const statusColors: any = {
    'Upcoming': 'bg-blue-100 text-blue-700 border-blue-200',
    'Live': 'bg-red-100 text-red-700 border-red-200',
    'Ended': 'bg-slate-100 text-slate-700 border-slate-200',
    'Cancelled': 'bg-gray-100 text-gray-700 border-gray-200',
    'UnVerified': 'bg-orange-100 text-orange-700 border-orange-200'
  };

  const status = rtData?.status || auction.status || auction.Status;
  const statusStyle = statusColors[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  const isLive = status === 'Live';

  const [timeRemaining, setTimeRemaining] = useState<number>(
    rtData?.secondsRemaining || auction.timeRemainingSeconds || auction.TimeRemainingSeconds || 0
  );

  useEffect(() => {
    if (status !== 'Live') return;
    const interval = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const formatTimeLocal = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const getRelativeDateText = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays > 1) return `in ${diffDays} days`;
    if (diffDays === -1) return "Yesterday";
    return date.toLocaleDateString();
  };

  const name = auction.productName || auction.ProductName || `Product ID: ${auction.productId || auction.ProductId}`;
  const desc = auction.productDescription || auction.ProductDescription || '';
  console.log(auction)
  const price = rtData?.currentHighestBid || auction.currentHighestBid || auction.startingPrice || auction.StartingPrice;

  return (
    <div
      className="bg-white rounded-[2.5rem] overflow-hidden hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 border border-slate-100 flex flex-col h-full relative group active:scale-[0.98]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* <div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
        <div className={`absolute top-4 right-4 z-20 transition-all duration-300 transform ${isHovered ? 'scale-100 opacity-100 translate-y-0' : 'scale-50 opacity-0 translate-y-2'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
            className="w-10 h-10 bg-white/90 backdrop-blur-md border border-white shadow-lg rounded-full flex items-center justify-center text-brand-accent hover:bg-brand-accent hover:text-white hover:border-brand-accent transition-all transform hover:rotate-12"
            title="View Complete Details"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>

        {isLive && (
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-[10px] font-black text-white uppercase tracking-wider">{viewerCount || 0} watching</span>
            </div>
          </div>
        )}
      </div> */}
      <div className={`absolute top-4 right-4 z-20 transition-all duration-300 transform ${isHovered ? 'scale-100 opacity-100 translate-y-0' : 'scale-50 opacity-0 translate-y-2'}`}>
        <button
          onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
          className="w-10 h-10 bg-white/90 backdrop-blur-md border border-white shadow-lg rounded-full flex items-center justify-center text-brand-accent hover:bg-brand-accent hover:text-white hover:border-brand-accent transition-all transform hover:rotate-12"
          title="View Complete Details"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      </div>

      <div className="p-6 pt-7 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm ${statusStyle}`}>
            <span className="flex items-center gap-1.5">
              {status === 'Live' && <span className="w-2 h-2 bg-red-600 rounded-full inline-block" />}
              {status}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 items-end">
            {isMine && (
              <span className="px-2.5 py-1 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-sm border border-slate-700">Your Auction</span>
            )}
            {((auction.winnerUserId || auction.WinnerUserId || auction.winnerId) === currentUser?.id) && (
              <span className="px-2.5 py-1 bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg shadow-sm flex items-center gap-1 border border-amber-400">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                Won!
              </span>
            )}
          </div>
        </div>

        <h3 className="text-xl font-black text-slate-900 mb-1 line-clamp-1 group-hover:text-brand-accent transition-colors" title={name}>{name}</h3>
        <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.15em] mb-4">REF: {id}</p>

        {desc && (
          <ul className="text-slate-500 text-sm mb-4 flex-1 space-y-1">
            {desc.split(',').filter((p: string) => p.trim()).slice(0, 3).map((point: string, idx: number) => (
              <li key={idx} className="flex gap-2 items-start">
                <span className="text-brand-accent font-black mt-0.5">•</span>
                <span className="line-clamp-1 font-medium">{point.trim().replace(/^[-*]\s*/, '')}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 mb-6 bg-slate-50 p-5 rounded-[1.5rem] border border-slate-100 shadow-inner flex-none">
          {price > 0 && (
            <div className="flex justify-between items-end border-b border-slate-200/60 pb-2 mb-2">
              <span className="text-slate-400 font-black uppercase text-[9px] tracking-[0.15em]">{status === 'Ended' ? 'Final Price' : (status === 'Upcoming' ? 'Starting' : 'Curr Bid')}</span>
              <span className="font-black text-brand-accent text-xl flex items-baseline gap-1">
                <span className="text-sm">₹</span>{price.toLocaleString()}
              </span>
            </div>
          )}

          {(auction.startingPrice || auction.StartingPrice) > 0 && status !== 'Upcoming' && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Starting</span>
              <span className="font-black text-slate-800 tracking-tight">₹{(auction.startingPrice || auction.StartingPrice).toLocaleString()}</span>
            </div>
          )}

          {status === 'Live' && (auction.totalBids || auction.TotalBids || rtData?.totalBids) > 0 && (
            <div className="flex justify-between items-center text-sm pt-2 mt-2 border-t border-slate-200/60">
              <span className="text-slate-400 font-bold uppercase text-[9px] tracking-widest">Total Bids</span>
              <span className="font-black text-slate-700 px-3 py-1 bg-slate-200/50 rounded-xl text-xs">{rtData?.totalBids || auction.totalBids || auction.TotalBids || 0}</span>
            </div>
          )}
        </div>

        <div className="border border-slate-100 p-3 rounded-[1.5rem] mt-auto mb-4 space-y-2 bg-white">
          {status === 'Upcoming' && (
            <div className="flex items-center gap-2 text-[11px] text-brand-accent font-black tracking-wide">
              <div className="w-6 h-6 rounded-full bg-brand-accent/10 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <span className="truncate">Starts <span className="underline decoration-brand-accent/30">{getRelativeDateText(auction.startDate || auction.StartDate)}</span></span>
            </div>
          )}

          {status === 'Live' ? (
            <div className="flex items-center gap-2 text-[11px] font-black text-white bg-red-500 p-2.5 rounded-xl shadow-md border border-red-600 tracking-wide justify-center">
              <svg className="w-4 h-4 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Ends in: {timeRemaining > 0 ? formatTimeLocal(timeRemaining) : (rtData?.secondsRemaining ? formatTimeLocal(rtData.secondsRemaining) : '00:00')}
            </div>
          ) : null}

          {status === 'Ended' && (
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 tracking-wider">
              <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </div>
              Ended: {new Date(auction.endDate || auction.EndDate).toLocaleString()}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-auto">
          {status === 'Upcoming' && (
            <button
              disabled={isWatched}
              className={`w-full py-3.5 rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl border ${isWatched ? 'bg-brand-accent text-white border-brand-accent shadow-brand-accent/20' : 'bg-slate-50 text-slate-600 hover:bg-brand-accent hover:text-white border-slate-200 hover:border-brand-accent shadow-transparent hover:shadow-brand-accent/20 active:scale-95'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {isWatched ? 'Watched' : 'Watch'}
            </button>
          )}

          {status === 'Live' && (
            <button
              onClick={() => router.push(`/auction/${id}`)}
              className="w-full py-3.5 bg-brand-accent text-white hover:bg-brand-dark border border-brand-accent rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-brand-accent/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Participate
            </button>
          )}

          {status === 'Ended' && (
            <button
              onClick={() => router.push(`/auction/${id}`)}
              className={`w-full py-3.5 rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border shadow-xl active:scale-95 ${win ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800 shadow-slate-900/20'}`}
            >
              {win ? 'View Win' : 'Results'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(s: number) {
  if (s <= 0) return "00:00";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function ProductDetailsModal({ isOpen, product, onClose, currentUser }: any) {
  const [activeImage, setActiveImage] = useState(0);
  const [ownerInfo, setOwnerInfo] = useState<any>(null);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [showOwner, setShowOwner] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveImage(0);
      setOwnerInfo(null);
      setShowOwner(false);
      setFullscreenImage(null);
    }
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const buyDate = product.product_buy_date || product.buyDate;
  const description = product.description || product.productDescription || '';
  const points = description.split(',').filter((p: string) => p.trim().length > 0);
  const images = product.images || (product.productImageUrl ? [{ imageUrl: product.productImageUrl }] : []);
  const isVerified = product.verified || product.isVerified;
  const userId = product.userId || product.user_id;

  const fetchOwnerDetails = async () => {
    if (ownerInfo) {
      setShowOwner(!showOwner);
      return;
    }
    setLoadingOwner(true);
    try {
      const res = await api.get(`/api/user/profile?id=${userId}`);
      if (res.success) {
        setOwnerInfo(res.data);
        setShowOwner(true);
      }
    } catch (err) {
      console.error("Failed to fetch owner details", err);
    } finally {
      setLoadingOwner(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto">
      {/* Lightbox */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-300" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} alt="Full Screen" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg transition-transform hover:scale-[1.02]" />
          <button className="absolute top-8 right-8 text-white/50 hover:text-white text-2xl">✕</button>
        </div>
      )}

      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300 relative my-8 border border-slate-100">
        <div className="relative h-80 bg-slate-50 flex items-center justify-center border-b border-slate-100">
          {images.length > 0 ? (
            <div className="relative group w-full h-80 overflow-hidden">
              <div
                className="flex h-full overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
                onScroll={(e: any) => {
                  const width = e.target.offsetWidth;
                  if (width > 0) setActiveImage(Math.round(e.target.scrollLeft / width));
                }}
              >
                {images.map((img: any, idx: number) => (
                  <div key={idx} className="w-full h-full flex-shrink-0 snap-start">
                    <img src={img.imageUrl} className="w-full h-full object-cover cursor-pointer" onClick={() => setFullscreenImage(img.imageUrl)} alt="" />
                  </div>
                ))}
              </div>
              {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-md rounded-full">
                  {images.map((_: any, idx: number) => (
                    <button key={idx} className={`w-1.5 h-1.5 rounded-full transition-all ${activeImage === idx ? 'bg-white w-3' : 'bg-white/50'}`} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-50">
              <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          )}
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm z-10 border border-slate-100">✕</button>
        </div>

        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1 pr-4">
              <h3 className="text-2xl font-black text-slate-900 mb-1 leading-tight break-words">{product.name || product.Name}</h3>
              {isVerified ? (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Bought: {buyDate ? new Date(buyDate).toLocaleDateString() : 'N/A'}
                </p>
              ) : (
                <span className="px-2 py-0.5 bg-orange-50 text-orange-500 text-[8px] font-black uppercase tracking-widest rounded">Unverified</span>
              )}
            </div>
            {product.auctionPrice > 0 && (
              <div className="text-right">
                <span className="text-xs font-black text-brand-accent bg-brand-light px-2 py-1 rounded-md">₹{(product.auctionPrice).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="mb-8 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/30">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-3 h-[1px] bg-slate-200"></span> Highlights
            </h4>
            <div className="space-y-2">
              {points.length > 0 ? points.map((p: string, i: number) => (
                <div key={i} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-accent flex-shrink-0" />
                  <span>{p.trim()}</span>
                </div>
              )) : <p className="text-sm text-slate-400 italic">No detailed highlights.</p>}
            </div>
          </div>

          {/* Owner Details */}
          <div className="mb-8">
            <button onClick={fetchOwnerDetails} className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-brand-accent/30 hover:shadow-lg transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-brand-light transition-colors">
                  <svg className="w-4 h-4 text-slate-600 group-hover:text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-800">Owner Details</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{showOwner ? 'Hide' : 'Show'}</p>
                </div>
              </div>
              {loadingOwner ? <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" /> :
                <svg className={`w-4 h-4 text-slate-300 transition-transform ${showOwner ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>}
            </button>
            {showOwner && ownerInfo && (
              <div className="mt-3 p-5 bg-white rounded-2xl border border-slate-100 shadow-xl animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 overflow-hidden text-xl font-black text-slate-300">
                    {ownerInfo.profileImage ? <img src={ownerInfo.profileImage} className="w-full h-full object-cover" alt="" /> : ownerInfo.name?.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm leading-tight">{ownerInfo.name}</h4>
                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase tracking-widest rounded">{ownerInfo.role || 'Member'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 pt-3 border-t border-slate-50">
                  <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Email</p>
                    <p className="text-xs font-bold text-slate-700">{ownerInfo.email}</p>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50/50 p-2 rounded-xl">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Phone</p>
                    <p className="text-xs font-bold text-slate-700">{ownerInfo.phone || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
