'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getAuctionConnection, listenToAuctionSafe, leaveAuctionRoomSafe } from '@/lib/auctionSignalR';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function WatchlistPage() {
  const [auctions, setAuctions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  // viewer counts keyed by auction id (string)
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({});
  // per-auction realtime data: { secondsRemaining, lastBid, status, message, endDate }
  const [auctionRtData, setAuctionRtData] = useState<Record<string, any>>({});
  const joinedRoomsRef = useRef<Set<string>>(new Set());
  
  // Filters and Pagination
  const [nameFilter, setNameFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [hasMore, setHasMore] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const currentUser = auth.getUser();
  const router = useRouter();

  const showToast = (msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  /** Update a single field in the per-auction realtime data map */
  const updateAuctionRt = (auctionId: string, patch: Record<string, any>) => {
    setAuctionRtData(prev => ({
      ...prev,
      [auctionId]: { ...(prev[auctionId] || {}), ...patch }
    }));
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
    };
    init();

    // Cleanup on unmount — leave all joined rooms safely
    return () => {
      getAuctionConnection().then(conn => {
        if (!conn) return;
        joinedRoomsRef.current.forEach(id => leaveAuctionRoomSafe(conn, id));
        joinedRoomsRef.current.clear();
      });
    };
  }, []); // Only once on mount

  // Handle filter changes (Reset to page 1)
  useEffect(() => {
    setPage(1);
    fetchWatchedAuctions(1, false);
  }, [nameFilter, statusFilter, startDateFilter, endDateFilter]);

  // Infinite Scroll Trigger
  useEffect(() => {
    if (loading || isFetchingMore || !hasMore) return;

    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prev => {
          const nextPage = prev + 1;
          fetchWatchedAuctions(nextPage, true);
          return nextPage;
        });
      }
    });

    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);

    return () => observerRef.current?.disconnect();
  }, [loading, isFetchingMore, hasMore]);

  const setupSignalR = useCallback(async (auctionList: any[]) => {
    const user = auth.getUser();
    if (!user) return;

    // Join rooms for: already Live OR any auction whose startDate is TODAY (in local IST time)
    // Using sv-SE locale format for accurate local date string comparison.
    const todayStr = new Date().toLocaleString('sv-SE').slice(0, 10); // "YYYY-MM-DD" in local time

    const toJoin = auctionList.filter(a => {
      const status = a.status || a.Status;
      const startDate = a.startDate || a.StartDate;
      if (status === 'Live') return true;
      if (startDate) {
        // Get local date string of the auction start date
        const sdStr = new Date(startDate).toLocaleString('sv-SE').slice(0, 10);
        return sdStr === todayStr; // Any auction starting today, any status
      }
      return false;
    });

    if (toJoin.length === 0) return;

    // Get (or create) the global connection — guaranteed Connected when returned
    const conn = await getAuctionConnection();
    if (!conn) return;

    // Register all event handlers once (guard with off() first to avoid duplicates)
    conn.off('ViewerCountUpdated');
    conn.off('BidPlaced');
    conn.off('TimerTick');
    conn.off('AuctionStarted');
    conn.off('AuctionClosed');
    conn.off('AuctionEndingSoon');
    conn.off('AuctionMessage');
    conn.off('AuctionAborted');
    conn.off('AuctionUnverified');

    // 👁 Viewer count — arrives per group, we update all joined rooms
    conn.on('ViewerCountUpdated', (count: number) => {
      joinedRoomsRef.current.forEach(id => {
        setViewerCounts(prev => ({ ...prev, [id]: count }));
      });
    });

    // 💰 Bid placed — { bidId, maskedBidder, amount, placedAt, newEndDate }
    conn.on('BidPlaced', (data: any) => {
      const id = String(data.auctionId ?? '');
      if (id) {
        updateAuctionRt(id, {
          lastBid: data,
          currentHighestBid: data.amount,
        });
      }
      // Update auction list top bid inline
      setAuctions(prev =>
        prev.map(a =>
          String(a.id || a.Id) === id
            ? { ...a, currentHighestBid: data.amount, endDate: data.newEndDate ?? (a.endDate || a.EndDate) }
            : a
        )
      );
    });

    // ⏱ Timer tick — { auctionId, secondsRemaining }
    conn.on('TimerTick', (data: { auctionId: number; secondsRemaining: number }) => {
      const id = String(data.auctionId);
      updateAuctionRt(id, { secondsRemaining: data.secondsRemaining });
    });

    // 🚀 Auction started — flip status to Live (already in the room, no need to JoinAuction again)
    conn.on('AuctionStarted', (data: { auctionId: number }) => {
      const id = String(data.auctionId);
      setAuctions(prev =>
        prev.map(a => String(a.id || a.Id) === id ? { ...a, status: 'Live', Status: 'Live' } : a)
      );
      showToast(`🚀 Auction #${id} has STARTED! Go to Watchlist to participate.`, 'success');
    });

    // 🏁 Auction closed — { winnerId, winnerName, winningAmount, ... }
    conn.on('AuctionClosed', (data: any) => {
      const id = data.auctionId ? String(data.auctionId) : '';
      setAuctions(prev =>
        prev.map(a => String(a.id || a.Id) === id ? { ...a, status: 'Ended', Status: 'Ended' } : a)
      );
      if (id) updateAuctionRt(id, { closed: true, winner: data });
      showToast(`🏁 Auction #${id} has ended! Winner: ${data.winnerName || 'TBD'}`, 'info');
    });

    // ⚠️ Ending soon — { auctionId, minutesRemaining }
    conn.on('AuctionEndingSoon', (data: { auctionId: number; minutesRemaining: number }) => {
      showToast(`⚠️ Auction #${data.auctionId} ends in ${data.minutesRemaining} minute(s)!`, 'warning');
    });

    // 💬 General message
    conn.on('AuctionMessage', (data: { message: string }) => {
      showToast(data.message, 'info');
    });

    // ❌ Aborted (product deleted)
    conn.on('AuctionAborted', (data: { auctionId: number; reason: string }) => {
      const id = String(data.auctionId);
      setAuctions(prev =>
        prev.map(a => String(a.id || a.Id) === id ? { ...a, status: 'Cancelled', Status: 'Cancelled' } : a)
      );
      showToast(`❌ Auction #${id} was cancelled. Reason: ${data.reason}`, 'error');
    });

    // 🔒 Unverified product during live
    conn.on('AuctionUnverified', (data: { auctionId: number; reason: string }) => {
      const id = String(data.auctionId);
      setAuctions(prev =>
        prev.map(a => String(a.id || a.Id) === id ? { ...a, status: 'Cancelled', Status: 'Cancelled' } : a)
      );
      showToast(`🔒 Auction #${id} stopped: ${data.reason}`, 'error');
    });

    // Join each relevant room
    for (const auction of toJoin) {
      const auctionId = String(auction.id || auction.Id);
      if (joinedRoomsRef.current.has(auctionId)) {
        continue;
      }
      await listenToAuctionSafe(conn, auctionId);
      joinedRoomsRef.current.add(auctionId);
    }
  }, []);

  const fetchWatchedAuctions = async (pageNum: number, append: boolean = false) => {
    try {
      if (append) setIsFetchingMore(true);
      else setLoading(true);

      const queryParams = new URLSearchParams();
      queryParams.append('page', pageNum.toString());
      queryParams.append('size', pageSize.toString());
      if (nameFilter) queryParams.append('name', nameFilter);
      if (statusFilter) queryParams.append('status', statusFilter);
      if (startDateFilter) queryParams.append('startDate', startDateFilter);
      if (endDateFilter) queryParams.append('endDate', endDateFilter);

      const res = await api.get(`/api/Watchlist/watched?${queryParams.toString()}`);
      if (res.success && res.data) {
        const data = res.data as any;
        const list = Array.isArray(data) ? data : (data.items || []);
        const total = Array.isArray(data) ? list.length : (data.total || list.length);
        
        if (append) {
          setAuctions(prev => [...prev, ...list]);
        } else {
          setAuctions(list);
        }
        setTotalItems(total);
        setHasMore(list.length === pageSize);
        setupSignalR(list);
      } else {
        if (!append) setAuctions([]);
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
      if (!append) setAuctions([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  };

  const toastColors = {
    success: 'bg-emerald-600 border-emerald-500',
    error: 'bg-red-600 border-red-500',
    info: 'bg-sky-600 border-sky-500',
    warning: 'bg-amber-500 border-amber-400 text-slate-900',
  };

  return (
    <div className="min-h-screen bg-slate-50 page-enter">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[999] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl font-semibold text-sm animate-slide-down border text-white ${toastColors[toast.type]}`}>
          {toast.type === 'success' && <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
          {toast.type === 'error' && <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
          {toast.type === 'warning' && <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>}
          {toast.type === 'info' && <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01" /></svg>}
          <span>{toast.msg}</span>
        </div>
      )}

      <Navbar />

      <main className="max-w-7xl mx-auto p-8">
        <header className="mb-8">
          <h2 className="text-4xl font-extrabold text-slate-900 mb-2">My Watchlist</h2>
          <p className="text-slate-500">Keep track of upcoming and currently live auctions you&apos;re interested in.</p>
        </header>

        {/* Filters */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8 z-20 relative">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Product Name</label>
              <input 
                type="text" 
                value={nameFilter} 
                onChange={e => { setNameFilter(e.target.value); setPage(1); }} 
                placeholder="Search watched auctions" 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none transition-all text-sm" 
              />
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Status</label>
              <select 
                value={statusFilter} 
                onChange={e => { setStatusFilter(e.target.value); setPage(1); }} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none text-sm text-slate-600"
              >
                <option value="">All Statuses</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Live">Live</option>
                <option value="Ended">Ended</option>
                <option value="Cancelled">Cancelled</option>
                <option value="UnVerified">UnVerified</option>
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Start Date</label>
              <input 
                type="date" 
                value={startDateFilter} 
                onChange={e => { setStartDateFilter(e.target.value); setPage(1); }} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none text-sm" 
              />
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">End Date</label>
              <input 
                type="date" 
                value={endDateFilter} 
                onChange={e => { setEndDateFilter(e.target.value); setPage(1); }} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none text-sm" 
              />
            </div>

            <div className="flex-none">
              <button 
                onClick={() => {
                  setNameFilter('');
                  setStatusFilter('');
                  setStartDateFilter('');
                  setEndDateFilter('');
                  setPage(1);
                }} 
                className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400 font-medium tracking-wide">Fetching your watchlist...</p>
          </div>
        ) : auctions.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-24 text-center shadow-sm border border-slate-100">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3">Your Watchlist is Empty</h3>
            <p className="text-slate-500 font-medium max-w-sm mx-auto">Click the Watch button on any upcoming auction to see it here.</p>
            <button onClick={() => router.push('/auctions')} className="mt-8 px-8 py-3 bg-brand-accent text-white font-bold rounded-xl shadow-lg hover:bg-brand-dark transition-all">
              Browse Auctions
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {auctions.map((auction: any) => (
                <WatchedAuctionCard
                  key={auction.id || auction.Id}
                  auction={auction}
                  viewerCount={viewerCounts[String(auction.id || auction.Id)]}
                  rtData={auctionRtData[String(auction.id || auction.Id)]}
                  onViewDetails={(prod) => {
                    setSelectedProduct({ ...prod, auctionPrice: auction.startingPrice || auction.StartingPrice });
                    setIsProductModalOpen(true);
                  }}
                  onUnwatch={(msg, ok) => {
                    showToast(msg, ok ? 'success' : 'error');
                    if (ok) {
                      const removedId = String(auction.id || auction.Id);
                      setAuctions(prev => prev.filter(a => String(a.id || a.Id) !== removedId));
                      // Leave SignalR room if joined
                      if (joinedRoomsRef.current.has(removedId)) {
                        getAuctionConnection().then(conn => {
                          conn?.invoke('LeaveAuction', removedId).catch(console.error);
                        });
                        joinedRoomsRef.current.delete(removedId);
                      }
                    }
                  }}
                />
              ))}
            </div>

            {/* Pagination Controls — Infinite Scroll Sentinel */}
            <div ref={sentinelRef} className="mt-12 mb-8 h-20 flex flex-col items-center justify-center">
              {isFetchingMore && (
                <>
                  <div className="w-8 h-8 border-3 border-brand-accent border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading more items...</p>
                </>
              )}
              {!hasMore && auctions.length > 0 && page > 1 && (
                <div className="flex flex-col items-center text-slate-300">
                  <div className="h-px w-24 bg-slate-100 mb-4" />
                  <p className="text-xs font-bold uppercase tracking-[0.2em]">End of your watchlist</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Product Details Modal */}
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
// WatchedAuctionCard
// ─────────────────────────────────────────────────────────────────────────────

function WatchedAuctionCard({ auction, onViewDetails, onUnwatch, viewerCount, rtData }: {
  auction: any;
  onViewDetails: (prod: any) => void;
  onUnwatch: (msg: string, ok: boolean) => void;
  viewerCount?: number;
  rtData?: any;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [ownerInfo, setOwnerInfo] = useState<any>(null);
  const [unwatching, setUnwatching] = useState(false);
  const router = useRouter();

  const statusColors: any = {
    'Upcoming': 'bg-blue-100 text-blue-700 border-blue-200',
    'Live': 'bg-red-100 text-red-700 border-red-200 animate-pulse',
    'Ended': 'bg-slate-100 text-slate-700 border-slate-200',
    'Cancelled': 'bg-gray-100 text-gray-700 border-gray-200',
    'UnVerified': 'bg-orange-100 text-orange-700 border-orange-200',
  };

  // Merge static auction data with realtime overrides
  const status = auction.status || auction.Status;
  const statusStyle = statusColors[status] || 'bg-slate-100 text-slate-700 border-slate-200';
  const currentHighestBid = rtData?.currentHighestBid ?? (auction.currentHighestBid || auction.CurrentHighestBid);

  // ⏱ Local countdown — starts from rtData.secondsRemaining (server truth)
  // and counts down by 1/s. Re-syncs whenever server sends a new TimerTick.
  const [localSeconds, setLocalSeconds] = useState<number>(
    rtData?.secondsRemaining ?? (auction.timeRemainingSeconds || auction.TimeRemainingSeconds || 0)
  );

  // Sync from server TimerTick
  useEffect(() => {
    if (rtData?.secondsRemaining !== undefined) {
      setLocalSeconds(Math.round(rtData.secondsRemaining));
    }
  }, [rtData?.secondsRemaining]);

  // Local 1-second interval between ticks
  useEffect(() => {
    if (status !== 'Live') return;
    const interval = setInterval(() => {
      setLocalSeconds(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Also seed from static auction data initially
  useEffect(() => {
    const staticSecs = auction.timeRemainingSeconds || auction.TimeRemainingSeconds;
    if (staticSecs && localSeconds === 0) setLocalSeconds(staticSecs);
  }, [auction]);

  useEffect(() => {
    const fetchOwner = async () => {
      try {
        const userId = auction.createdByUserId || auction.CreatedByUserId;
        if (!userId) return;
        const res = await api.get(`/api/user/profile/${userId}`);
        if (res.success && res.data) setOwnerInfo(res.data);
      } catch (err) { console.error('Failed to fetch owner details', err); }
    };
    fetchOwner();
  }, [auction]);

  const formatTime = (seconds: number) => {
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
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date); targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays > 1) return `in ${diffDays} days`;
    if (diffDays === -1) return 'Yesterday';
    return date.toLocaleDateString();
  };

  const name = auction.productName || auction.ProductName || 'Unknown Product';
  const desc = auction.productDescription || auction.ProductDescription;
  const lastBid = rtData?.lastBid;

  const handleQuickView = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.post('/api/Product/all', { productId: auction.productId || auction.ProductId }, false);
      if (res.success && res.data) {
        const arr = res.data as any[];
        if (arr.length > 0) onViewDetails({ ...arr[0], auctionPrice: auction.startingPrice || auction.StartingPrice });
      }
    } catch (err) { console.error('Failed to fetch product details', err); }
  };

  const handleUnwatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (unwatching) return;
    setUnwatching(true);
    try {
      const auctionId = auction.id || auction.Id;
      const res = await api.delete(`/api/Watchlist/${auctionId}/watch`);
      onUnwatch(res.message || (res.success ? 'Removed from watchlist' : 'Could not remove'), res.success);
    } catch (err: any) {
      onUnwatch(err?.message || 'Something went wrong', false);
    } finally { setUnwatching(false); }
  };

  return (
    <div
      className="premium-card bg-white rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-500 border border-slate-100 flex flex-col h-full relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Eye button – top right on hover */}
      <div className={`absolute top-4 right-4 z-20 transition-all duration-300 ${isHovered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-75 translate-y-2 pointer-events-none'}`}>
        <button
          onClick={handleQuickView}
          className="w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center text-brand-accent hover:bg-brand-accent hover:text-white transition-all"
          title="View Complete Details"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      </div>

      {/* Owner info – top left on hover */}
      {ownerInfo && (
        <div className={`absolute top-4 left-4 z-20 transition-all duration-300 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'}`}>
          <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg px-3 py-2 border border-slate-100">
            <img src={ownerInfo.imageUrl || 'https://via.placeholder.com/150'} alt="Owner" className="w-8 h-8 rounded-full object-cover flex-shrink-0 border-2 border-white shadow-sm" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-tight truncate">{ownerInfo.name || ownerInfo.Name}</span>
              {(ownerInfo.phone || ownerInfo.Phone) && (
                <span className="text-[9px] text-slate-500 font-medium leading-tight flex items-center gap-1">
                  <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  {ownerInfo.phone || ownerInfo.Phone}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="p-6 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${statusStyle}`}>
            <span className="flex items-center gap-1">
              {status === 'Live' && <span className="w-1.5 h-1.5 bg-red-600 rounded-full inline-block" />}
              {status}
            </span>
          </div>
        </div>

        <h3 className="text-xl font-black text-slate-900 mb-1 line-clamp-1" title={name}>{name}</h3>
        {desc && (
          <ul className="text-slate-500 text-xs mb-4 space-y-1">
            {desc.split(',').filter((p: string) => p.trim()).slice(0, 3).map((point: string, idx: number) => (
              <li key={idx} className="flex gap-1.5 items-start">
                <span className="text-brand-accent font-bold mt-0.5">•</span>
                <span className="line-clamp-1 leading-relaxed">{point.trim().replace(/^[-*]\s*/, '')}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Latest SignalR Bid Banner */}
        {lastBid && (
          <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 text-xs font-bold text-green-700 animate-in fade-in">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            New bid ₹{lastBid.amount?.toLocaleString()} by {lastBid.maskedBidder}
          </div>
        )}

        <div className="space-y-3 mb-5 bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
          {status === 'Live' && currentHighestBid > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Curr Bid</span>
              <span className="font-black text-brand-accent text-lg flex items-baseline gap-1">
                <span className="text-xs">₹</span>{currentHighestBid.toLocaleString()}
              </span>
            </div>
          )}
          {(auction.startingPrice || auction.StartingPrice) > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Starting</span>
              <span className="font-bold text-slate-700">₹{(auction.startingPrice || auction.StartingPrice).toLocaleString()}</span>
            </div>
          )}
          {(auction.reservePrice || auction.ReservePrice) > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Reserve</span>
              <span className="font-bold text-slate-700">₹{(auction.reservePrice || auction.ReservePrice).toLocaleString()}</span>
            </div>
          )}
          {status === 'Live' && (auction.totalBids || auction.TotalBids) > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Total Bids</span>
              <span className="font-bold text-slate-700 px-2 py-0.5 bg-slate-200 rounded-md text-xs">{auction.totalBids || auction.TotalBids}</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4 mt-auto space-y-2">
          {status !== 'UnVerified' && (
            <>
              {status === 'Upcoming' && (
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="truncate">Starts: <span className="font-bold text-brand-accent">{getRelativeDateText(auction.startDate || auction.StartDate)}</span> at {new Date(auction.startDate || auction.StartDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
              {status === 'Live' && (
                <div className="space-y-1.5">
                  {localSeconds > 0 && (
                    <div className="flex items-center gap-2 text-xs font-black text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                      <svg className="w-4 h-4 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Ends in: {formatTime(localSeconds)}
                    </div>
                  )}
                  {viewerCount !== undefined && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <svg className="w-3 h-3 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span><span className="font-black text-brand-accent">{viewerCount}</span> watching live</span>
                    </div>
                  )}
                  {/* Participate Now button for Live auctions */}
                  <button
                    onClick={() => router.push(`/auction/${auction.id || auction.Id}`)}
                    className="w-full py-2 rounded-xl font-bold text-sm bg-brand-accent text-white hover:bg-brand-dark transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Participate Now
                  </button>
                </div>
              )}
              {status === 'Ended' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 justify-center">
                    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Ended on: {new Date(auction.endDate || auction.EndDate).toLocaleString('en-IN')}
                  </div>
                  <button
                    onClick={() => router.push(`/auction/${auction.id || auction.Id}`)}
                    className="w-full py-2 rounded-xl font-bold text-sm bg-slate-800 text-white hover:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-sm border border-slate-700"
                  >
                    View Winner
                  </button>
                </div>
              )}
              {status === 'Cancelled' && (
                <div className="flex items-center gap-2 text-xs font-medium text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-200">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  Cancelled
                </div>
              )}
            </>
          )}

          {/* Unwatch Button */}
          <button
            onClick={handleUnwatch}
            disabled={unwatching}
            className="w-full mt-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border bg-red-50 text-red-600 border-red-200 hover:bg-red-600 hover:text-white hover:border-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {unwatching ? (
              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
            )}
            {unwatching ? 'Removing...' : 'Unwatch'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ProductDetailsModal (unchanged from before)
// ─────────────────────────────────────────────────────────────────────────────

function ProductDetailsModal({ isOpen, product, onClose, currentUser }: any) {
  const [activeImage, setActiveImage] = useState(0);
  const [ownerInfo, setOwnerInfo] = useState<any>(null);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [showOwner, setShowOwner] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) { setActiveImage(0); setOwnerInfo(null); setShowOwner(false); setFullscreenImage(null); }
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const buyDate = product.product_buy_date || product.buyDate;
  const description = product.description || '';
  const points = description.split(',').filter((p: string) => p.trim().length > 0);
  const images = product.images || [];
  const isVerified = product.verified || product.isVerified;
  const isOwner = (product.user_id || product.userId) == currentUser?.id;

  const fetchOwnerDetails = async () => {
    if (ownerInfo) { setShowOwner(!showOwner); return; }
    setLoadingOwner(true);
    try {
      const userId = product.userId || product.user_id;
      const res = await api.get(`/api/user/profile/${userId}`);
      if (res.success) { setOwnerInfo(res.data); setShowOwner(true); }
    } catch (err) { console.error('Failed to fetch owner details', err); }
    finally { setLoadingOwner(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto">
      {fullscreenImage && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-300" onClick={() => setFullscreenImage(null)}>
          <img src={fullscreenImage} alt="Full Screen" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
          <button className="absolute top-8 right-8 text-white/50 hover:text-white text-2xl">✕</button>
        </div>
      )}
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300 relative my-8 border border-slate-100">
        <div className="relative h-80 bg-slate-50 flex items-center justify-center border-b border-slate-100">
          {images && images.length > 0 ? (
            <div className="relative group bg-slate-100 h-80 overflow-hidden w-full">
              <div className="flex h-full overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth" onScroll={(e: any) => { const sl = e.target.scrollLeft, w = e.target.offsetWidth; if (w > 0) setActiveImage(Math.round(sl / w)); }}>
                {images.map((img: any, idx: number) => (
                  <div key={idx} className="w-full h-full flex-shrink-0 snap-start relative">
                    <img src={img.imageUrl} alt={product.Name} className="w-full h-full object-cover cursor-pointer" onClick={() => setFullscreenImage(img.imageUrl)} />
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
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          )}
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm z-10 border border-slate-100">✕</button>
        </div>
        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1 pr-4">
              <h3 className="text-2xl font-black text-slate-900 mb-1 leading-tight break-words">{product.Name || product.name}</h3>
              {isVerified ? (
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <svg className="w-3 h-3 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  Bought: {buyDate ? new Date(buyDate).toLocaleDateString() : 'N/A'}
                </p>
              ) : (
                <span className="px-2 py-0.5 bg-orange-50 text-orange-500 text-[8px] font-black uppercase tracking-widest rounded">Unverified</span>
              )}
            </div>
            {(product.auctionPrice || product.basePrice) > 0 && (
              <div className="text-right">
                <span className="text-xs font-black text-brand-accent bg-brand-light px-2 py-1 rounded-md whitespace-nowrap">₹{(product.auctionPrice || product.basePrice || 0).toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="mb-8 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/30">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-3 h-[1px] bg-slate-200"></span>Highlights
            </h4>
            <div className="space-y-2">
              {points.map((pt: string, i: number) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-brand-accent font-bold mt-0.5">•</span>
                  <span className="text-slate-600 text-sm leading-relaxed">{pt.trim().replace(/^[-*]\s*/, '')}</span>
                </div>
              ))}
            </div>
          </div>
          {!isOwner && (
            <div className="mb-6">
              <button onClick={fetchOwnerDetails} className="w-full py-3 bg-white border border-slate-200 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2 shadow-sm">
                {loadingOwner ? <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                {showOwner ? 'Hide Owner Details' : 'View Owner Details'}
              </button>
              {showOwner && ownerInfo && (
                <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                    <img src={ownerInfo.imageUrl || 'https://via.placeholder.com/150'} alt="Owner" className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" />
                    <div>
                      <h5 className="font-bold text-slate-900 text-sm">{ownerInfo.name || ownerInfo.Name}</h5>
                      <a href={`mailto:${ownerInfo.email || ownerInfo.Email}`} className="text-xs text-brand-accent hover:underline">{ownerInfo.email || ownerInfo.Email}</a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


