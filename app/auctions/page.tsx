'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { statusColors, MAX_AUCTION_DURATION_MINUTES } from '@/lib/constants';
import { getRelativeDateText, formatTime } from '@/lib/utils';
import Navbar from '@/components/Navbar';

export default function AuctionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AuctionsContent />
    </Suspense>
  );
}

function AuctionsContent() {
  const [auctions, setAuctions] = useState<any[]>([]);
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Filters
  const [status, setStatus] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [name, setName] = useState('');
  const [mine, setMine] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState(false);

  useEffect(() => {
    const search = searchParams.get('search');
    if (search) {
      setName(search);
      setSearchTrigger(prev => !prev);
    }
  }, [searchParams]);

  // Modals
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isAuctionModalOpen, setIsAuctionModalOpen] = useState(false);
  const [auctionProduct, setAuctionProduct] = useState<any>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [is404, setIs404] = useState(false);

  const currentUser = auth.getUser();
  const router = useRouter();

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

      if (!user) {
        router.push('/login');
        return;
      }
      fetchAuctions(page > 1);
    };
    init();
  }, [page, searchTrigger, mine, status]);

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
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [loading, hasMore]);

  const fetchAuctions = async (isLoadMore = false) => {
    setLoading(true);
    if (!isLoadMore) setIs404(false);

    const queryParams = new URLSearchParams();
    queryParams.append('Page', page.toString());
    queryParams.append('PageSize', '20');
    if (status) queryParams.append('Status', status);
    if (minPrice) queryParams.append('MinPrice', minPrice);
    if (maxPrice) queryParams.append('MaxPrice', maxPrice);
    if (name) queryParams.append('name', name);
    if (mine) queryParams.append('mine', 'true');

    try {
      const res = await api.get(`/api/auctions?${queryParams.toString()}`);
      console.log(res);
      if (res.success && (res.data as any)?.items) {
        const newData = (res.data as any).items as any[];
        setHasMore(newData.length === 20); // matching PageSize
        setAuctions(prev => isLoadMore ? [...prev, ...newData] : newData);
        if (newData.length === 0 && !isLoadMore) setIs404(true);
      } else {
        if (res.statusCode === 404 || res.message?.toLowerCase().includes("not found")) {
          if (!isLoadMore) {
            setIs404(true);
            setAuctions([]);
          }
          setHasMore(false);
        } else {
          showNotification(res.message || "Failed to fetch auctions", 'error');
          if (!isLoadMore) setAuctions([]);
        }
      }
    } catch (err) {
      console.error(err);
      if (!isLoadMore) {
        setIs404(true);
        setAuctions([]);
      }
      setHasMore(false);
      showNotification("Network error. Please try again.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (page !== 1) setPage(1);
    setSearchTrigger(prev => !prev);
  };

  const handleClear = () => {
    setName('');
    setStatus('');
    setMinPrice('');
    setMaxPrice('');
    setMine(false);
    if (page !== 1) setPage(1);
    setSearchTrigger(prev => !prev);
  };

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="min-h-screen bg-slate-50 page-enter">
      <Navbar />

      <main className="max-w-7xl mx-auto p-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-4xl font-extrabold text-slate-900 mb-2">
              Auction Arena
            </h2>
            <p className="text-slate-500">
              Discover, track, and participate in exclusive live auctions.
            </p>
          </div>
        </header>

        {/* Filters */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8 z-20 relative">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Product Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Search auctions" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none transition-all text-sm" />
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none text-sm text-slate-600">
                <option value="">All Statuses</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Live">Live</option>
                <option value="Ended">Ended</option>
                <option value="Cancelled">Cancelled</option>
                <option value="UnVerified">UnVerified</option>
                <option value="Verified">Verified</option>
              </select>
            </div>

            <div className="flex-[0.5] min-w-[120px]">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Min Price (₹)</label>
              <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none text-sm" />
            </div>

            <div className="flex-[0.5] min-w-[120px]">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Max Price (₹)</label>
              <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none text-sm" />
            </div>

            <div className="flex-none min-w-[120px]">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">My Auctions</label>
              <div className="flex items-center h-[46px]">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={mine} onChange={e => {
                    setMine(e.target.checked);
                    setPage(1);
                  }} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent"></div>
                </label>
              </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
              <button onClick={handleClear} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm w-full md:w-auto">
                Clear
              </button>
              <button onClick={handleSearch} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 text-sm w-full md:w-auto flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                Filter
              </button>
            </div>
          </div>
        </div>

        {/* Auction Grid */}
        {loading && auctions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400 font-medium tracking-wide">Fetching auctions...</p>
          </div>
        ) : is404 || auctions.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-24 text-center shadow-sm border border-slate-100">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3">No Auctions Found</h3>
            <p className="text-slate-500 font-medium max-w-sm mx-auto">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {auctions.map((auction: any) => (
                <AuctionCard
                  key={auction.id || auction.Id}
                  auction={auction}
                  currentUser={currentUser}
                  onUpdate={() => {
                    setSelectedAuction(auction);
                    setIsUpdateModalOpen(true);
                  }}
                  onViewDetails={(prod) => {
                    setSelectedProduct({ ...prod, auctionPrice: auction.startingPrice || auction.StartingPrice });
                    setIsProductModalOpen(true);
                  }}
                  onLaunch={(prod: any) => {
                    setAuctionProduct(prod);
                    setIsAuctionModalOpen(true);
                  }}
                  onWatchSuccess={(msg: string) => showNotification(msg, 'success')}
                  onWatchError={(msg: string) => showNotification(msg, 'error')}
                  onRefresh={() => setSearchTrigger(prev => !prev)}
                />
              ))}
            </div>

            {hasMore ? (
              <div ref={observerTarget} className="flex justify-center py-12 mt-8">
                {loading && <div className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />}
              </div>
            ) : (
              <div className="text-center py-12 mt-8">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">End of auctions list</p>
              </div>
            )}
          </>
        )}

        <StandaloneUpdateAuctionModal
          isOpen={isUpdateModalOpen}
          auction={selectedAuction}
          onClose={() => setIsUpdateModalOpen(false)}
          onSuccess={() => { setIsUpdateModalOpen(false); handleSearch(); showNotification("Auction updated successfully!", "success"); }}
          onError={(msg: string) => showNotification(msg, "error")}
        />

        <ProductDetailsModal
          isOpen={isProductModalOpen}
          product={selectedProduct}
          onClose={() => setIsProductModalOpen(false)}
          currentUser={currentUser}
          onLaunchAuction={(prod: any) => {
            setAuctionProduct(prod);
            setIsAuctionModalOpen(true);
          }}
        />

        <CreateAuctionModal
          isOpen={isAuctionModalOpen}
          product={auctionProduct}
          onClose={() => setIsAuctionModalOpen(false)}
          onSuccess={() => {
            setIsAuctionModalOpen(false);
            showNotification("Auction launched successfully!", "success");
            setSearchTrigger(p => !p);
          }}
          onError={(msg: string) => showNotification(msg, "error")}
        />

        <UpdateAuctionModal
          isOpen={isUpdateModalOpen}
          product={selectedProduct}
          onClose={() => setIsUpdateModalOpen(false)}
          onSuccess={() => {
            setIsUpdateModalOpen(false);
            showNotification("Auction updated successfully!", "success");
            setSearchTrigger(p => !p);
          }}
          onError={(msg: string) => showNotification(msg, "error")}
        />

        {notification && (
          <div className={`fixed bottom-8 right-8 p-4 rounded-xl shadow-2xl z-50 animate-bounce ${notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
            <p className="font-bold flex items-center gap-2">
              {notification.type === 'error' ? 'Oops!' : 'Success!'}
              <span className="font-normal">{notification.msg}</span>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function AuctionCard({ auction, currentUser, onUpdate, onViewDetails, onLaunch, onWatchSuccess, onWatchError, onRefresh }: { auction: any, currentUser: any, onUpdate: () => void, onViewDetails: (prod: any) => void, onLaunch: (prod: any) => void, onWatchSuccess?: (msg: string) => void, onWatchError?: (msg: string) => void, onRefresh: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const router = useRouter();

  const isMine = auction.createdByUserId == currentUser?.id || auction.CreatedByUserId == currentUser?.id;

  const auctionStatusColors: Record<string, string> = {
    ...statusColors,
    'Verified': 'bg-emerald-100 text-emerald-700 border-emerald-200'
  };

  const status = auction.status || auction.Status;
  const statusStyle = auctionStatusColors[status] || 'bg-slate-100 text-slate-700 border-slate-200';

  const startDateObj = new Date(auction.startDate || auction.StartDate);
  const now = new Date();
  // Cancellation is allowed only before the start date for owners
  const canCancel = isMine && now < startDateObj && (status === 'Upcoming' || status === 'Verified');

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to cancel this auction?')) return;
    try {
      const res = await api.delete(`/api/auctions/${auction.id || auction.Id}`);
      if (res.success) {
        onRefresh(); // Trigger refresh instead of opening update modal
      } else {
        alert(res.message || "Failed to cancel auction");
      }
    } catch (err: any) {
      alert(err.message || "An error occurred while cancelling.");
    }
  };

  // Countdown — state seeded from API value, interval ticks every 1s
  const [timeRemaining, setTimeRemaining] = useState<number>(
    auction.timeRemainingSeconds || auction.TimeRemainingSeconds || 0
  );

  // Only recreate interval when Live status changes — NOT on every tick
  useEffect(() => {
    if (status !== 'Live') return;
    const interval = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);



  const handleWatch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.post(`/api/Watchlist/${auction.id || auction.Id}/watch`, {}, false);
      if (res.success) {
        setIsWatched(true);
        if (onWatchSuccess) onWatchSuccess(res.message || "Auction watched successfully");
      } else {
        if (onWatchError) onWatchError(res.message || "Failed to watch auction");
      }
    } catch (err: any) {
      console.error("Failed to watch auction", err);
      if (onWatchError) onWatchError(err.message || "Failed to watch auction");
    }
  };

  const name = auction.productName || auction.ProductName || `Product ID: ${auction.productId || auction.ProductId}`;
  const desc = auction.productDescription || auction.ProductDescription;

  const handleQuickView = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await api.post('/api/Product/all', { productId: auction.productId || auction.ProductId }, false);
      if (res.success && res.data) {
        const productsArray = res.data as any[];
        if (productsArray.length > 0) {
          onViewDetails(productsArray[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch product details", err);
    }
  };

  return (
    <div
      className="premium-card bg-white rounded-3xl overflow-hidden hover:shadow-2xl transition-all duration-500 border border-slate-100 flex flex-col h-full relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated Hover Icon for Product Details */}
      <div className={`absolute top-4 right-4 z-20 transition-all duration-300 transform ${isHovered ? 'scale-110 opacity-100 translate-y-0' : 'scale-50 opacity-0 translate-y-2'}`}>
        <button
          onClick={handleQuickView}
          className="w-10 h-10 bg-white shadow-lg rounded-full flex items-center justify-center text-brand-accent hover:bg-brand-accent hover:text-white transition-all transform hover:rotate-12"
          title="View Complete Details"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
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
        </div>

        <h3 className="text-xl font-black text-slate-900 mb-1 line-clamp-1" title={name}>{name}</h3>
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
          {status
            !== 'Upcoming' && (auction.currentHighestBid || auction.CurrentHighestBid) > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{status == "Live" ? "Current Bid" : status == "Ended" ? "Final Price" : "Last Bid"}</span>
                <span className="font-black text-brand-accent text-lg flex items-baseline gap-1">
                  <span className="text-xs">₹</span>{(auction.currentHighestBid || auction.CurrentHighestBid || 0).toLocaleString()}
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
              <span className="font-bold text-slate-700 px-2 py-0.5 bg-slate-200 rounded-md text-xs">{auction.totalBids || auction.TotalBids || 0}</span>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4 mt-auto mb-4 space-y-2">
          {status !== 'UnVerified' && (
            <>
              {status === 'Upcoming' && (
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="truncate">Starts: <span className="font-bold text-brand-accent">{getRelativeDateText(auction.startDate || auction.StartDate)}</span> at {new Date(auction.startDate || auction.StartDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}

              {status === 'Live' ? (
                <div className="flex items-center gap-2 text-xs font-black text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                  <svg className="w-4 h-4 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Ends in: {timeRemaining > 0 ? formatTime(timeRemaining) : 'Ending...'}
                </div>
              ) : null}

              {status === 'Ended' && (
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Ended on: {new Date(auction.endDate || auction.EndDate).toLocaleString()}
                </div>
              )}

              {status === 'Cancelled' && (
                <div className="flex items-center gap-2 text-xs font-medium text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-200">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  Cancelled on: {new Date(auction.endDate || auction.EndDate).toLocaleString()}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 mt-auto">
          {/* Allow update for upcoming, verified, and cancelled auctions as per user request */}
          {isMine && (status === 'Upcoming' || status === 'Verified' || status === 'Cancelled') && (
            <button onClick={onUpdate} className="flex-1 py-3 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white border border-amber-200 hover:border-amber-500 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              {status === 'Verified' ? 'Setup & Launch' : 'Update'}
            </button>
          )}

          {canCancel && (
            <button onClick={handleCancel} className="flex-1 py-3 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white border border-red-200 hover:border-red-500 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Cancel
            </button>
          )}

          {!isMine && status === 'Upcoming' && (
            <button onClick={handleWatch} disabled={isWatched} className={`flex-1 py-3 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm border ${isWatched ? 'bg-brand-accent text-white border-brand-accent' : 'bg-slate-50 text-slate-600 hover:bg-brand-accent hover:text-white border-slate-200 hover:border-brand-accent'}`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              {isWatched ? 'Watched' : 'Watch'}
            </button>
          )}

          {status === 'Live' && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (!isMine)
                  if (!isWatched) {
                    try {
                      await api.post(`/api/Watchlist/${auction.id || auction.Id}/watch`, {}, false);
                    } catch (err) { /* ignore */ }
                  }
                router.push(`/auction/${auction.id || auction.Id}`);
              }}
              className="flex-1 py-3 bg-red-50 text-red-600 hover:bg-brand-accent hover:text-white border border-red-200 hover:border-brand-accent rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              {isMine ? 'View Auction' : 'Participate Now'}
            </button>
          )}

          {status === 'Ended' && (
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/auction/${auction.id || auction.Id}`); }}
              className="flex-1 py-3 bg-slate-800 text-white hover:bg-slate-700 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm border border-slate-700"
            >
              View Winner
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StandaloneUpdateAuctionModal({ isOpen, auction, onClose, onSuccess, onError }: any) {
  const [startingPrice, setStartingPrice] = useState('');
  const [reservePrice, setReservePrice] = useState('');
  const [minBidIncrement, setMinBidIncrement] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && auction) {
      setStartingPrice(auction.startingPrice?.toString() || auction.StartingPrice?.toString() || '');
      setReservePrice(auction.reservePrice?.toString() || auction.ReservePrice?.toString() || '');
      setMinBidIncrement(auction.minBidIncrement?.toString() || auction.MinBidIncrement?.toString() || '');

      const sDateRaw = auction.startDate || auction.StartDate;
      if (sDateRaw) {
        const sd = new Date(sDateRaw);
        setStartDate(sd.getFullYear() + "-" + String(sd.getMonth() + 1).padStart(2, '0') + "-" + String(sd.getDate()).padStart(2, '0'));
        setStartTime(String(sd.getHours()).padStart(2, '0') + ":" + String(sd.getMinutes()).padStart(2, '0'));

        const eDateRaw = auction.endDate || auction.EndDate;
        if (eDateRaw) {
          const ed = new Date(eDateRaw);
          const diffMs = ed.getTime() - sd.getTime();
          const diffMins = Math.round(diffMs / 60000);
          setDurationMinutes(diffMins.toString());
        } else {
          setDurationMinutes(MAX_AUCTION_DURATION_MINUTES.toString());
        }
      }
    } else {
      setStartingPrice('');
      setReservePrice('');
      setMinBidIncrement('');
      setStartDate('');
      setStartTime('');
      setDurationMinutes('');
    }
  }, [isOpen, auction]);

  if (!isOpen || !auction) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const auctionId = auction.id || auction.Id;
    if (!auctionId) return onError("Auction ID missing.");

    try {
      setLoading(true);

      let startDateTime: Date | null = null;
      let endDateTime: Date | null = null;

      if (startDate && startTime) {
        startDateTime = new Date(`${startDate}T${startTime}`);
        if (startDateTime <= new Date()) {
          return onError("Start time must be in the future.");
        }
        if (durationMinutes) {
          const duration = parseInt(durationMinutes);
          endDateTime = new Date(startDateTime.getTime() + duration * 60000);
        }
      }

      const payload: any = {
        ReservePrice: reservePrice ? parseFloat(reservePrice) : null,
        MinBidIncrement: minBidIncrement ? parseFloat(minBidIncrement) : null,
        StartDate: startDateTime ? startDateTime.toLocaleString('sv-SE').replace(' ', 'T') : null,
        EndDate: endDateTime ? endDateTime.toLocaleString('sv-SE').replace(' ', 'T') : null
      };

      // Only include StartingPrice if no bids have been placed
      if (!(auction.totalBids > 0 || auction.TotalBids > 0)) {
        payload.StartingPrice = startingPrice ? parseFloat(startingPrice) : null;
      }

      const res = await api.patch(`/api/auctions/${auctionId}`, payload, false);

      if (res.success) {
        onSuccess();
      } else {
        onError(res.message || "Failed to update auction.");
      }
    } catch (err: any) {
      onError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 pt-28 pb-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl my-8 overflow-hidden animate-in fade-in zoom-in duration-300 relative">
        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">
              {auction.status === 'UnVerified' || auction.Status === 'UnVerified' ? 'Launch Auction Setup' : 'Update Auction'}
            </h3>
            <p className="text-slate-500 text-sm mt-1 mb-0">
              {auction.status === 'UnVerified' || auction.Status === 'UnVerified' ? 'Complete your auction details' : `Modify settings for ${auction.productName || auction.ProductName}`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:shadow-md transition-all">
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Starting Price (₹) {(auction.totalBids > 0 || auction.TotalBids > 0) && <span className="text-[10px] text-red-500 font-black ml-1">(Locked: Bids exist)</span>}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={startingPrice}
                    onChange={e => setStartingPrice(e.target.value)}
                    disabled={auction.totalBids > 0 || auction.TotalBids > 0}
                    className={`w-full pl-8 pr-5 py-3 rounded-xl border outline-none transition-all ${(auction.totalBids > 0 || auction.TotalBids > 0) ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200' : 'border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'}`}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-bold text-slate-700">Reserve Price (₹)</label>
                  <div className="group relative flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-500 text-[10px] font-bold cursor-help border border-blue-100">
                    i
                    <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-xs rounded-lg shadow-xl -left-20 z-10">
                      Optional: The minimum amount you expect to win.
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 font-bold">₹</span>
                  <input type="number" min="0" step="0.01" value={reservePrice} onChange={e => setReservePrice(e.target.value)} className="w-full pl-8 pr-5 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all" placeholder="Optional" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Min Bid Increment (₹)</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-slate-400 font-bold">₹</span>
                <input type="number" min="0" step="0.01" value={minBidIncrement} onChange={e => setMinBidIncrement(e.target.value)} className="w-full pl-8 pr-5 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all" placeholder="Optional" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Start Date</label>
                <input type="date" min={new Date().toLocaleString('sv-SE').replace(' ', 'T').split('T')[0]} value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-700" title="Optional" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Start Time</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-slate-700" title="Optional" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Duration (Minutes)</label>
              <input type="number" min="1" max={MAX_AUCTION_DURATION_MINUTES} value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all" placeholder="Max 30 mins" title="Optional" />
              <p className="text-xs text-slate-400 mt-2 font-medium">Max duration is {MAX_AUCTION_DURATION_MINUTES} minutes. Leave blank to keep existing duration.</p>
            </div>

          </div>

          <div className="pt-4 flex gap-4">
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 px-6 py-4 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-[2] premium-button bg-brand-accent text-white shadow-xl shadow-brand-accent/20 py-4 flex items-center justify-center gap-2 hover:bg-brand-accent/90">
              {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Processing...' : (auction.status === 'UnVerified' || auction.Status === 'UnVerified' ? 'Launch Auction' : 'Update Auction')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductDetailsModal({ isOpen, product, onClose, currentUser, onLaunchAuction }: any) {
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
  const description = product.description || '';
  // Separating by comma as requested
  const points = description.split(',').filter((p: string) => p.trim().length > 0);
  const images = product.images || [];
  const isVerified = product.verified || product.isVerified;

  const isOwner = (product.user_id || product.userId) == currentUser?.id;

  const fetchOwnerDetails = async () => {
    if (ownerInfo) {
      setShowOwner(!showOwner);
      return;
    }
    setLoadingOwner(true);
    try {
      const userId = product.userId || product.user_id;
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 pt-28 pb-8 bg-slate-900/40 backdrop-blur-md overflow-y-auto">
      {/* Lightbox Overlay */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-300"
          onClick={() => setFullscreenImage(null)}
        >
          <img src={fullscreenImage} alt="Full Screen" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg transition-transform hover:scale-[1.02]" />
          <button className="absolute top-8 right-8 text-white/50 hover:text-white text-2xl">✕</button>
        </div>
      )}

      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300 relative my-8 border border-slate-100">
        <div className="relative h-80 bg-slate-50 flex items-center justify-center border-b border-slate-100">
          {images && images.length > 0 ? (
            <>
              <div className="relative group bg-slate-100 h-80 overflow-hidden">
                <div
                  className="flex h-full overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-smooth"
                  onScroll={(e: any) => {
                    const scrollLeft = e.target.scrollLeft;
                    const width = e.target.offsetWidth;
                    if (width > 0) {
                      setActiveImage(Math.round(scrollLeft / width));
                    }
                  }}
                >
                  {images.map((img: any, idx: number) => (
                    <div key={idx} className="w-full h-full flex-shrink-0 snap-start relative">
                      <img
                        src={img.imageUrl}
                        alt={product.Name}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setFullscreenImage(img.imageUrl)}
                      />
                    </div>
                  ))}
                </div>

                {images.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-md rounded-full">
                    {images.map((_: any, idx: number) => (
                      <button
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${activeImage === idx ? 'bg-white w-3' : 'bg-white/50'}`}
                        onClick={(e) => {
                          const container = e.currentTarget.parentElement?.previousElementSibling;
                          if (container) {
                            (container as HTMLElement).scrollTo({ left: idx * (container as HTMLElement).offsetWidth, behavior: 'smooth' });
                          }
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-50">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all shadow-sm z-10 border border-slate-100">✕</button>
        </div>

        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1 pr-4">
              <h3 className="text-2xl font-black text-slate-900 mb-1 leading-tight break-words">{product.Name || product.name}</h3>
              {/* Show date only if verified */}
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
                <span className="text-xs font-black text-brand-accent bg-brand-light px-2 py-1 rounded-md whitespace-nowrap">
                  ₹{(product.auctionPrice || product.basePrice || 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="mb-8 p-4 bg-slate-50/50 rounded-2xl border border-slate-100/30">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span className="w-3 h-[1px] bg-slate-200"></span>
              Highlights
            </h4>
            <div className="space-y-2">
              {points.length > 0 ? points.map((p: string, i: number) => (
                <div key={i} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-accent flex-shrink-0" />
                  <span>{p.trim()}</span>
                </div>
              )) : (
                <p className="text-sm text-slate-400 italic">No detailed highlights provided.</p>
              )}
            </div>
          </div>

          {/* Owner Details Section */}
          <div className="mb-8">
            <button
              onClick={fetchOwnerDetails}
              className="w-full flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-brand-accent/30 hover:shadow-lg hover:shadow-brand-accent/5 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-brand-light transition-colors">
                  <svg className="w-4 h-4 text-slate-600 group-hover:text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-800">Owner Details</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{showOwner ? 'Click to hide' : 'Click to reveal'}</p>
                </div>
              </div>
              {loadingOwner ? (
                <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className={`w-4 h-4 text-slate-300 transition-transform duration-300 ${showOwner ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              )}
            </button>

            {showOwner && ownerInfo && (
              <div className="mt-3 p-5 bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-900/5 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center shadow-inner overflow-hidden border border-slate-100">
                    {ownerInfo.profileImage ? (
                      <img src={ownerInfo.profileImage} alt={ownerInfo.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-black text-slate-300">{ownerInfo.name?.charAt(0)}</span>
                    )}
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
                    <p className="text-xs font-bold text-slate-700">
                      {ownerInfo.phone || ownerInfo.Phone || ownerInfo.mobile || ownerInfo.Mobile || 'N/A'}
                    </p>
                  </div>
                  <div className="flex flex-col bg-slate-50/50 p-2 rounded-xl">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Address</p>
                    <p className="text-xs font-bold text-slate-700 line-clamp-2">{ownerInfo.address || ownerInfo.Address || 'N/A'}</p>
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

function CreateAuctionModal({ isOpen, product, onClose, onSuccess, onError }: any) {
  const [startingPrice, setStartingPrice] = useState('');
  const [reservePrice, setReservePrice] = useState('');
  const [minBidIncrement, setMinBidIncrement] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStartingPrice(product?.basePrice?.toString() || '');
      setReservePrice('');
      setMinBidIncrement('');
      setStartDate('');
      setStartTime('');
      setDurationMinutes(MAX_AUCTION_DURATION_MINUTES.toString());
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const startDateTime = new Date(`${startDate}T${startTime}`);
      if (startDateTime <= new Date()) {
        return onError("Start time must be in the future.");
      }
      const duration = parseInt(durationMinutes);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

      const payload = {
        ProductId: product.id,
        StartingPrice: parseFloat(startingPrice),
        ReservePrice: reservePrice ? parseFloat(reservePrice) : null,
        MinBidIncrement: parseFloat(minBidIncrement),
        StartDate: startDateTime.toLocaleString('sv-SE').replace(' ', 'T'),
        EndDate: endDateTime.toLocaleString('sv-SE').replace(' ', 'T')
      };

      // If it exists (e.g. status was UnVerified), we should use PATCH instead of POST /api/verify/auction.
      let existingAuctionId = null;
      try {
        const createdRes = await api.get('/api/auctions/created');
        console.log("here")
        console.log(createdRes)
        if (createdRes.success && createdRes.data) {
          const auctions = createdRes.data as any[];
          const myAuction = auctions.find(a => (a.productId === product.id || a.ProductId === product.id));
          if (myAuction) {
            existingAuctionId = myAuction.id || myAuction.Id;
          }
        }
      } catch (e) { console.error("Error checking for existing auction:", e); }

      let res;
      if (existingAuctionId) {
        // If it exists, use the update (PATCH) endpoint correctly as per user request
        res = await api.patch(`/api/auctions/${existingAuctionId}`, {
          StartingPrice: parseFloat(startingPrice),
          ReservePrice: reservePrice ? parseFloat(reservePrice) : null,
          MinBidIncrement: parseFloat(minBidIncrement),
          StartDate: startDateTime.toLocaleString('sv-SE').replace(' ', 'T'),
          EndDate: endDateTime.toLocaleString('sv-SE').replace(' ', 'T')
        }, false);
      } else {
        // Otherwise, use the initial launch (POST) endpoint
        res = await api.post('/api/verify/auction', payload, false);
      }

      if (res.success) onSuccess();
      else onError(res.message || "Failed to process auction launch.");
    } catch (err: any) {
      onError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 pt-28 pb-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl my-8 overflow-hidden animate-in fade-in zoom-in duration-300 relative">
        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Create Auction</h3>
            <p className="text-slate-500 text-sm mt-1">Setup an auction for {product.name || product.Name}</p>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:shadow-md transition-all">
            ✕
          </button>
        </header>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Starting Price (₹)</label>
                <input type="number" value={startingPrice} onChange={e => setStartingPrice(e.target.value)} required className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-accent/20 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Reserve Price (₹)</label>
                <input type="number" value={reservePrice} onChange={e => setReservePrice(e.target.value)} className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-accent/20 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Min Bid Increment (₹)</label>
              <input type="number" value={minBidIncrement} onChange={e => setMinBidIncrement(e.target.value)} required className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-accent/20 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="w-full px-5 py-3 rounded-xl border border-slate-200" />
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="w-full px-5 py-3 rounded-xl border border-slate-200" />
            </div>
            <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} max={MAX_AUCTION_DURATION_MINUTES} required className="w-full px-5 py-3 rounded-xl border border-slate-200" />
          </div>
          <div className="pt-4 flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 font-bold bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" disabled={loading} className="flex-[2] py-4 bg-brand-accent text-white font-bold rounded-xl shadow-lg">
              {loading ? 'Creating...' : 'Launch Auction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UpdateAuctionModal({ isOpen, product, onClose, onSuccess, onError }: any) {
  const [startingPrice, setStartingPrice] = useState('');
  const [reservePrice, setReservePrice] = useState('');
  const [minBidIncrement, setMinBidIncrement] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [auctionId, setAuctionId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && product) {
      fetchAuctionDetails();
    }
  }, [isOpen, product]);

  const fetchAuctionDetails = async () => {
    setFetching(true);
    try {
      const res = await api.get('/api/auctions/created');
      console.log(res)
      if (res.success && res.data) {
        const auctions = res.data as any[];
        const myAuction = auctions.find(a => a.productId === product.id || a.ProductId === product.id);
        if (myAuction) {
          setAuctionId(myAuction.id || myAuction.Id);
          setStartingPrice(myAuction.startingPrice?.toString() || '');
          setReservePrice(myAuction.reservePrice?.toString() || '');
          setMinBidIncrement(myAuction.minBidIncrement?.toString() || '');
          const sd = new Date(myAuction.startDate || myAuction.StartDate);
          setStartDate(sd.toLocaleString('sv-SE').replace(' ', 'T').split('T')[0]);
          setStartTime(sd.toTimeString().split(' ')[0].substring(0, 5));
          const ed = new Date(myAuction.endDate || myAuction.EndDate);
          setDurationMinutes(Math.round((ed.getTime() - sd.getTime()) / 60000).toString());
        }
      }
    } catch (e) { } finally { setFetching(false); }
  };

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auctionId) return;
    try {
      setLoading(true);
      const startDateTime = new Date(`${startDate}T${startTime}`);
      if (startDateTime <= new Date()) {
        return onError("Start time must be in the future.");
      }
      const endDateTime = new Date(startDateTime.getTime() + parseInt(durationMinutes) * 60000);
      const payload = {
        StartingPrice: parseFloat(startingPrice),
        ReservePrice: reservePrice ? parseFloat(reservePrice) : null,
        MinBidIncrement: parseFloat(minBidIncrement),
        StartDate: startDateTime.toLocaleString('sv-SE').slice(0, 10),
        EndDate: endDateTime.toLocaleString('sv-SE').slice(0, 10)
      };
      const res = await api.patch(`/api/auctions/${auctionId}`, payload, false);

      if (res.success) onSuccess();
      else onError(res.message);
    } catch (err: any) { onError(err.message); } finally { setLoading(false); }
  };

  if (fetching) return <div className="fixed inset-0 z-[50] flex items-center justify-center px-4 pt-28 pb-8 bg-white/50">Loading...</div>;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 pt-28 pb-8 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2rem] w-full max-w-xl p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400">✕</button>
        <h3 className="text-2xl font-black mb-6">Update Auction</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <input type="number" value={startingPrice} onChange={e => setStartingPrice(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="Starting Price" />
            <input type="number" value={reservePrice} onChange={e => setReservePrice(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="Reserve Price" />
          </div>
          <input type="number" value={minBidIncrement} onChange={e => setMinBidIncrement(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="Min Bid Increment" />
          <div className="grid grid-cols-2 gap-4">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 border rounded-xl" />
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-3 border rounded-xl" />
          </div>
          <input type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} className="w-full p-3 border rounded-xl" placeholder="Duration" />
          <button type="submit" disabled={loading} className="w-full py-4 bg-amber-500 text-white font-bold rounded-xl">
            {loading ? 'Updating...' : 'Update Auction'}
          </button>
        </form>
      </div>
    </div>
  );
}

function DetailItem({ label, value, iconColor }: any) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-sm font-black text-slate-800 ${iconColor || ''}`}>{value || 'N/A'}</p>
    </div>
  );
}
