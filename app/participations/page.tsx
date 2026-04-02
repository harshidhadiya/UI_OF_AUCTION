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
    <div className="min-h-screen bg-slate-50 page-enter">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[999] px-5 py-4 rounded-2xl shadow-2xl font-semibold text-sm animate-slide-down border text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      <Navbar />

      <main className="max-w-7xl mx-auto p-8">
        <header className="mb-8">
          <h2 className="text-4xl font-extrabold text-slate-900 mb-2">My Participations</h2>
          <p className="text-slate-500">Manage auctions you have placed bids on.</p>
        </header>

        {/* Filters Panel */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-10 overflow-visible relative z-20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Search</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Product name..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none text-sm">
                <option value="">All Statuses</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Live">Live</option>
                <option value="Ended">Ended</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Price Range (₹)</label>
              <div className="flex gap-2">
                <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="Min" className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Max" className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Date Range</label>
              <div className="flex gap-2">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs" title="Start Date" />
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-2 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs" title="End Date" />
              </div>
            </div>
            <div className="flex items-center h-[54px]">
              <button
                onClick={() => { setWinOnly(!winOnly); if (page !== 1) setPage(1); setSearchTrigger(p => !p); }}
                className={`w-full h-full flex items-center justify-center gap-2 rounded-xl border-2 transition-all font-bold px-4 ${winOnly ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-inner' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-brand-accent/30 hover:text-slate-500'}`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${winOnly ? 'bg-amber-500 border-amber-500' : 'bg-white border-slate-300'}`}>
                  {winOnly && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm">Only Won Auctions</span>
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={handleClear} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm">Clear</button>
            <button onClick={handleSearch} className="px-8 py-3 bg-brand-accent text-white font-bold rounded-xl hover:bg-brand-dark transition-all shadow-lg text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              Apply Filters
            </button>
          </div>
        </div>

        {loading && auctions.length === 0 ? (
          <div className="flex flex-col items-center py-20 bg-white rounded-3xl border border-slate-100">
            <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400 font-medium">Loading your participations...</p>
          </div>
        ) : auctions.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-24 text-center border border-slate-100">
            <h3 className="text-2xl font-black text-slate-800 mb-3">No Participations Found</h3>
            <p className="text-slate-500 font-medium max-w-sm mx-auto mb-8">You haven't placed any bids that match these filters.</p>
            <Link href="/auctions" className="px-8 py-3 bg-brand-accent text-white font-bold rounded-xl shadow-lg">Browse Auctions</Link>
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
                  win={winOnly}
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
    'Live': 'bg-red-100 text-red-700 border-red-200 animate-pulse',
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
      className="premium-card bg-white rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-500 border border-slate-100 flex flex-col h-full relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="aspect-[4/3] bg-slate-100 overflow-hidden relative">
        {/* <img src={auction.productImageUrl || auction.ProductImageUrl || 'https://via.placeholder.com/400x300?text=No+Image'} alt={name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" /> */}

        {/* Animated Hover Icon for Product Details */}
        <div className={`absolute top-4 right-4 z-20 transition-all duration-300 transform ${isHovered ? 'scale-110 opacity-100 translate-y-0' : 'scale-50 opacity-0 translate-y-2'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
            className="w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center text-brand-accent hover:bg-brand-accent hover:text-white transition-all transform hover:rotate-12"
            title="View Complete Details"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
        </div>

        {isLive && (
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">{viewerCount || 0} watching</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusStyle}`}>
            <span className="flex items-center gap-1">
              {status === 'Live' && <span className="w-1.5 h-1.5 bg-red-600 rounded-full inline-block"></span>}
              {status}
            </span>
          </div>
          {isMine && (
            <span className="px-2 py-1 bg-slate-900 text-white text-[9px] font-bold rounded shadow-sm">Your Auction</span>
          )}
          {((auction.winnerUserId || auction.WinnerUserId || auction.winnerId) === currentUser?.id) && (
            <span className="px-2 py-1 bg-amber-500 text-white text-[9px] font-bold rounded shadow-sm flex items-center gap-1">
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              You Won!
            </span>
          )}
        </div>

        <h3 className="text-xl font-black text-slate-900 mb-1 line-clamp-1" title={name}>{name}</h3>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4">Auction #{id}</p>

        {desc && (
          <ul className="text-slate-500 text-xs mb-4 flex-1 space-y-1">
            {desc.split(',').filter((p: string) => p.trim()).map((point: string, idx: number) => (
              <li key={idx} className="flex gap-1.5 items-start">
                <span className="text-brand-accent font-bold mt-0.5">•</span>
                <span className="line-clamp-1 leading-relaxed">{point.trim().replace(/^[-*]\s*/, '')}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100/50 flex-1">
          {price > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{status === 'Ended' ? 'Final Price' : (status === 'Upcoming' ? 'Starting' : 'Curr Bid')}</span>
              <span className="font-black text-brand-accent text-lg flex items-baseline gap-1">
                <span className="text-xs">₹</span>{price.toLocaleString()}
              </span>
            </div>
          )}

          {(auction.startingPrice || auction.StartingPrice) > 0 && status !== 'Upcoming' && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Starting</span>
              <span className="font-bold text-slate-700">₹{(auction.startingPrice || auction.StartingPrice).toLocaleString()}</span>
            </div>
          )}

          {status === 'Live' && (auction.totalBids || auction.TotalBids || rtData?.totalBids) > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Total Bids</span>
              <span className="font-bold text-slate-700 px-2 py-0.5 bg-slate-200 rounded-md text-xs">{rtData?.totalBids || auction.totalBids || auction.TotalBids || 0}</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4 mt-auto mb-4 space-y-2">
          {status === 'Upcoming' && (
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="truncate">Starts: <span className="font-bold text-brand-accent">{getRelativeDateText(auction.startDate || auction.StartDate)}</span></span>
            </div>
          )}

          {status === 'Live' ? (
            <div className="flex items-center gap-2 text-xs font-black text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Ends in: {timeRemaining > 0 ? formatTimeLocal(timeRemaining) : (rtData?.secondsRemaining ? formatTimeLocal(rtData.secondsRemaining) : '00:00')}
            </div>
          ) : null}

          {status === 'Ended' && (
            <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Ended on: {new Date(auction.endDate || auction.EndDate).toLocaleString()}
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-auto">
          {status === 'Upcoming' && (
            <button
              disabled={isWatched}
              className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm border ${isWatched ? 'bg-brand-accent text-white border-brand-accent' : 'bg-slate-50 text-slate-600 hover:bg-brand-accent hover:text-white border-slate-200 hover:border-brand-accent'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {isWatched ? 'Watched' : 'Watch'}
            </button>
          )}

          {status === 'Live' && (
            <button
              onClick={() => router.push(`/auction/${id}`)}
              className="flex-1 py-3 bg-red-50 text-red-600 hover:bg-brand-accent hover:text-white border border-red-200 hover:border-brand-accent rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Participate Now
            </button>
          )}

          {status === 'Ended' && (
            <button
              onClick={() => router.push(`/auction/${id}`)}
              className="flex-1 py-3 bg-slate-800 text-white hover:bg-slate-700 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm border border-slate-700"
            >
              {win ? 'View Winner' : 'View Details'}
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
      const res = await api.get(`/api/user/profile/${userId}`);
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
