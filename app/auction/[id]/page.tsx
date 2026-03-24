'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { getAuctionConnection, joinAuctionRoomSafe, leaveAuctionRoomSafe } from '@/lib/auctionSignalR';

export default function LiveAuctionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const currentUser = auth.getUser();

  const [auction, setAuction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bidHistory, setBidHistory] = useState<any[]>([]);
  const [myBids, setMyBids] = useState<any[]>([]);
  const [bidAmount, setBidAmount] = useState('');
  const [bidding, setBidding] = useState(false);
  const [bidError, setBidError] = useState('');
  const [bidSuccess, setBidSuccess] = useState('');
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [viewerCount, setViewerCount] = useState<number | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [winner, setWinner] = useState<any>(null);
  const [auctionMessages, setAuctionMessages] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'bids' | 'mine'>('bids');
  const joinedRef = useRef(false);
  const bidListRef = useRef<HTMLDivElement>(null);
  const myBidListRef = useRef<HTMLDivElement>(null);

  // Pagination for bids
  const [bidPage, setBidPage] = useState(1);
  const [bidHasMore, setBidHasMore] = useState(true);
  const [bidsLoading, setBidsLoading] = useState(false);
  const bidObserverTarget = useRef<HTMLDivElement>(null);

  // Pagination for my bids
  const [myBidPage, setMyBidPage] = useState(1);
  const [myBidHasMore, setMyBidHasMore] = useState(true);
  const [myBidsLoading, setMyBidsLoading] = useState(false);
  const myBidObserverTarget = useRef<HTMLDivElement>(null);

  // ─── Fetch initial data ───────────────────────────────────────────
  const fetchAuction = useCallback(async () => {
    try {
      const token = auth.getToken();
      const auctionRes = await api.get(`/api/auctions/${id}`, token!);
      console.log(auctionRes);

      if (auctionRes.success && auctionRes.data) {
        const a = auctionRes.data as any;
        setAuction(a);
        const secs = a.timeRemainingSeconds ?? 0;
        setSecondsRemaining(Math.max(0, Math.round(secs)));

        if (a.status === 'Ended') {
          setIsClosed(true);
          let winnerObj = a.winner;

          // If we have a winner and the current user is the owner or winner, fetch winner details
          const currentUserData = auth.getUser();
          if (winnerObj && currentUserData) {
            try {
              const winnerId = winnerObj.winnerUserId || winnerObj.WinnerUserId || winnerObj.winnerId;
              const isOwnerOrWinner = a.createdByUserId === currentUserData.id || String(winnerId) === String(currentUserData.id);

              if (isOwnerOrWinner && winnerId) {
                const userRes = await api.get(`/api/User/profile/${winnerId}`, token!);
                if (userRes.success && userRes.data) {
                  const userData = userRes.data as any;
                  winnerObj = {
                    ...winnerObj,
                    winnerName: userData.name || userData.Name,
                    winnerEmail: userData.email || userData.Email,
                    winnerPhone: userData.phoneNumber || userData.PhoneNumber || userData.phone || userData.Phone
                  };
                }
              }
            } catch (e) {
              console.error('Failed to fetch winner profile:', e);
            }
          }
          setWinner(winnerObj);
        }

        if (a.liveViewerCount) setViewerCount(a.liveViewerCount);
        return a.status;
      }
    } catch (err) {
      console.error('Failed to load auction:', err);
    } finally {
      setLoading(false);
    }
    return null;
  }, [id]);

  const fetchBids = useCallback(async (pageToFetch: number) => {
    try {
      setBidsLoading(true);
      const token = auth.getToken();
      const res = await api.get(`/api/auctions/${id}/bids?page=${pageToFetch}&pageSize=10&size=10&mine=false`, token!);
      if (res.success && res.data) {
        const newBids = (res.data as any).items || [];
        if (pageToFetch === 1) {
          setBidHistory(newBids);
        } else {
          setBidHistory(prev => {
            // deduplicate any new bids that might have arrived via SignalR
            const existingIds = new Set(prev.map(b => b.id));
            const uniqueNewBids = newBids.filter((b: any) => !existingIds.has(b.id));
            return [...prev, ...uniqueNewBids];
          });
        }
        setBidHasMore((res.data as any).hasNextPage ?? (newBids.length > 0));
      } else {
        setBidHasMore(false);
      }
    } catch {
      setBidHasMore(false);
    } finally {
      setBidsLoading(false);
    }
  }, [id]);

  const fetchMyBids = useCallback(async (pageToFetch: number = 1) => {
    try {
      setMyBidsLoading(true);
      const token = auth.getToken();
      const res = await api.get(`/api/auctions/${id}/bids?page=${pageToFetch}&pageSize=10&size=10&mine=true`, token!);
      if (res.success && res.data) {
        const newBids = (res.data as any).items || [];
        if (pageToFetch === 1) {
          setMyBids(newBids);
        } else {
          setMyBids(prev => {
            const existingIds = new Set(prev.map((b: any) => b.id));
            const uniqueNewBids = newBids.filter((b: any) => !existingIds.has(b.id));
            return [...prev, ...uniqueNewBids];
          });
        }
        setMyBidHasMore((res.data as any).hasNextPage ?? (newBids.length > 0));
      } else {
        setMyBidHasMore(false);
      }
    } catch {
      setMyBidHasMore(false);
    } finally {
      setMyBidsLoading(false);
    }
  }, [id]);

  // ─── SignalR setup ────────────────────────────────────────────────
  const setupSignalR = useCallback(async () => {
    const token = auth.getToken();
    if (!token) return;
    const conn = await getAuctionConnection(token);
    if (!conn) return;

    // Register handlers (off first to avoid duplicate registrations)
    conn.off('TimerTick');
    conn.off('BidPlaced');
    conn.off('AuctionStarted');
    conn.off('AuctionClosed');
    conn.off('AuctionEndingSoon');
    conn.off('AuctionMessage');
    conn.off('AuctionAborted');
    conn.off('AuctionUnverified');
    conn.off('ViewerCountUpdated');

    conn.on('TimerTick', (data: { auctionId: number; secondsRemaining: number }) => {
      if (String(data.auctionId) !== String(id)) return;
      setSecondsRemaining(Math.max(0, Math.round(data.secondsRemaining)));
    });

    conn.on('BidPlaced', (data: any) => {
      if (data.auctionId && String(data.auctionId) !== String(id)) return;
      // New bid arrives
      const newBid = {
        id: data.bidId,
        maskedBidder: data.maskedBidder,
        amount: data.amount,
        placedAt: data.placedAt,
        status: 'Active',
      };
      setBidHistory(prev => [newBid, ...prev]);
      setAuction((prev: any) => ({
        ...prev,
        currentHighestBid: data.amount,
        endDate: data.newEndDate ?? prev?.endDate,
      }));
      // Scroll bid list to top
      setTimeout(() => bidListRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 100);
    });

    conn.on('AuctionClosed', (data: any) => {
      if (data.auctionId && String(data.auctionId) !== String(id)) return;
      setIsClosed(true);
      setWinner(data);
      setAuction((prev: any) => ({ ...prev, status: 'Ended' }));
    });

    conn.on('AuctionEndingSoon', (data: { auctionId: number; minutesRemaining: number }) => {
      if (String(data.auctionId) !== String(id)) return;
      setAuctionMessages(prev => [`⚠️ Ending in ${data.minutesRemaining} min(s)! Place your bid now.`, ...prev.slice(0, 4)]);
    });

    conn.on('AuctionMessage', (data: { message: string }) => {
      setAuctionMessages(prev => [data.message, ...prev.slice(0, 4)]);
    });

    conn.on('AuctionAborted', (data: { auctionId: number; reason: string }) => {
      if (String(data.auctionId) !== String(id)) return;
      setIsClosed(true);
      setAuction((prev: any) => ({ ...prev, status: 'Cancelled' }));
      setAuctionMessages(prev => [`❌ ${data.reason}`, ...prev]);
    });

    conn.on('AuctionUnverified', (data: { auctionId: number; reason: string }) => {
      if (String(data.auctionId) !== String(id)) return;
      setIsClosed(true);
      setAuction((prev: any) => ({ ...prev, status: 'Cancelled' }));
      setAuctionMessages(prev => [`🔒 ${data.reason}`, ...prev]);
    });

    conn.on('ViewerCountUpdated', (count: number) => {
      setViewerCount(count);
    });

    // Join auction room
    if (!joinedRef.current) {
      await joinAuctionRoomSafe(conn, String(id));
      joinedRef.current = true;
    }
  }, [id]);

  useEffect(() => {
    if (!currentUser) { router.push('/login'); return; }

    fetchAuction().then(status => {
      fetchBids(1);
      fetchMyBids(1);
      if (status !== 'Ended' && status !== 'Cancelled' && status !== 'UnVerified') {
        setupSignalR();
      }
    });

    // Cleanup: leave room on unmount
    return () => {
      getAuctionConnection(auth.getToken()!).then(conn => {
        if (!conn || !joinedRef.current) return;
        leaveAuctionRoomSafe(conn, String(id));
        joinedRef.current = false;
      });
    };
  }, [id]);

  // ─── Local 1-second countdown ─────────────────────────────────────
  useEffect(() => {
    if (isClosed) return;
    const interval = setInterval(() => {
      setSecondsRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isClosed]);

  // ─── Bid History Infinite Scroll ──────────────────────────────────
  useEffect(() => {
    if (!bidObserverTarget.current || bidsLoading || !bidHasMore || activeTab !== 'bids') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setBidPage(p => p + 1);
      }
    }, { root: bidListRef.current, threshold: 0.1 });

    observer.observe(bidObserverTarget.current);
    return () => observer.disconnect();
  }, [bidsLoading, bidHasMore, activeTab]);

  useEffect(() => {
    if (bidPage > 1) {
      fetchBids(bidPage);
    }
  }, [bidPage, fetchBids]);

  // ─── My Bids Infinite Scroll ──────────────────────────────────────
  useEffect(() => {
    if (!myBidObserverTarget.current || myBidsLoading || !myBidHasMore || activeTab !== 'mine') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setMyBidPage(p => p + 1);
      }
    }, { root: myBidListRef.current, threshold: 0.1 });

    observer.observe(myBidObserverTarget.current);
    return () => observer.disconnect();
  }, [myBidsLoading, myBidHasMore, activeTab]);

  useEffect(() => {
    if (myBidPage > 1) {
      fetchMyBids(myBidPage);
    }
  }, [myBidPage, fetchMyBids]);

  // ─── Place bid ────────────────────────────────────────────────────
  const handlePlaceBid = async () => {
    const minBidAmount = (auction?.currentHighestBid || auction?.startingPrice || 0) + (auction?.minBidIncrement || 1);
    setBidding(true);
    setBidError('');
    setBidSuccess('');
    try {
      const token = auth.getToken();
      const res = await api.post(`/api/auctions/${id}/bids`, { amount: minBidAmount }, false, token!);
      if (res.success) {
        setBidSuccess(res.message || 'Bid placed successfully!');
        setMyBidPage(1);
        fetchMyBids(1);
        setTimeout(() => setBidSuccess(''), 4000);
      } else {
        setBidError(res.message || 'Failed to place bid');
      }
    } catch (err: any) {
      setBidError(err?.message || 'Something went wrong');
    } finally {
      setBidding(false);
    }
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const formatCurrency = (n: number) => `₹${n?.toLocaleString('en-IN')}`;

  const status = auction?.status || 'Loading';
  const isLive = status === 'Live';
  const isMine = currentUser && (auction?.createdByUserId == currentUser.id);
  const minBid = (auction?.currentHighestBid || auction?.startingPrice || 0) + (auction?.minBidIncrement || 1);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 font-medium">Loading auction room...</p>
      </div>
    </div>
  );

  if (!auction) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="text-center">
        <p className="text-2xl font-black mb-4">Auction not found</p>
        <button onClick={() => router.push('/auctions')} className="px-6 py-3 bg-brand-accent rounded-xl font-bold">Back to Auctions</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* ─── Top Nav ─── */}
      <nav className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="w-9 h-9 bg-slate-800 hover:bg-slate-700 rounded-full flex items-center justify-center transition-all">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 className="font-black text-lg leading-tight">{auction.productName || 'Live Auction'}</h1>
              <p className="text-slate-400 text-xs">Auction #{id}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {viewerCount !== null && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-full">
                <svg className="w-3 h-3 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                <span className="font-bold text-white">{viewerCount}</span> watching
              </div>
            )}
            <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${isLive ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' :
              status === 'Upcoming' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' :
                status === 'Ended' ? 'bg-slate-700 text-slate-300 border-slate-600' :
                  'bg-gray-700 text-gray-300 border-gray-600'
              }`}>
              {isLive && <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block mr-1" />}
              {status}
            </div>
          </div>
        </div>
      </nav>

      {/* ─── Auction Closed Banner ─── */}
      {isClosed && (
        <div className={`${auction?.status === 'Cancelled' ? 'bg-gray-800 border-gray-700' : 'bg-gradient-to-r from-amber-500/20 to-amber-600/10 border-amber-500/30'} border-b px-6 py-4`}>
          <div className="max-w-7xl mx-auto flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              {winner?.finalPrice ? (
                <>
                  <p className="font-black text-amber-300">🏆 Auction Closed — Winner Declared</p>
                  <p className="text-slate-300 text-sm">Winning bid: <span className="font-bold text-amber-300">{formatCurrency(winner.finalPrice || winner.FinalPrice)}</span></p>

                  {(isMine || String(currentUser?.id) === String(winner?.winnerUserId || winner?.WinnerUserId || winner?.winnerId)) && (
                    <div className="mt-4 bg-black/30 rounded-2xl p-5 border border-amber-500/20 shadow-inner w-full sm:min-w-[400px]">
                      <h4 className="text-amber-400 font-bold mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        Winner Details ({isMine ? 'Owner View' : 'Your Winning Details'})
                      </h4>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                        <div>
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Winner ID</p>
                          <p className="font-bold text-white">{winner.winnerUserId || winner.WinnerUserId || winner.winnerId || winner.WinnerId || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Final Amount</p>
                          <p className="font-bold text-emerald-400 text-lg">{formatCurrency(winner.finalPrice || winner.FinalPrice)}</p>
                        </div>
                        {(winner.winnerName || winner.WinnerName) && (
                          <div className="col-span-2">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Name</p>
                            <p className="font-bold text-white">{winner.winnerName || winner.WinnerName}</p>
                          </div>
                        )}
                        {(winner.winnerEmail || winner.WinnerEmail) && (
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Email</p>
                            <p className="font-bold text-white text-xs">{winner.winnerEmail || winner.WinnerEmail}</p>
                          </div>
                        )}
                        {(winner.winnerPhone || winner.WinnerPhone) && (
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Phone</p>
                            <p className="font-bold text-white text-xs">{winner.winnerPhone || winner.WinnerPhone}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="font-black text-slate-300">{auction?.status === 'Cancelled' ? '❌ Auction Cancelled' : auction.win ? '🏁 Auction Ended — Winner Declared' : '🏁 Auction Ended — No Winner'}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Auction Messages ─── */}
      {auctionMessages.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          {auctionMessages.slice(0, 2).map((msg, i) => (
            <div key={i} className="mb-2 bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm font-medium px-4 py-2 rounded-xl">
              {msg}
            </div>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Left: Auction Info + Timer ─── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Timer */}
          {isLive && (
            <div className={`rounded-3xl p-6 border text-center ${secondsRemaining < 120 ? 'bg-red-500/10 border-red-500/40' : 'bg-slate-900 border-slate-800'}`}>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">Time Remaining</p>
              <div className={`text-5xl font-black tabular-nums tracking-tight mb-1 ${secondsRemaining < 120 ? 'text-red-400' : 'text-white'}`}>
                {secondsRemaining > 0 ? formatTime(secondsRemaining) : 'Ending...'}
              </div>
              {secondsRemaining < 120 && secondsRemaining > 0 && (
                <p className="text-red-400 text-xs font-bold animate-pulse mt-1">⚡ Bid now — any bid extends by 2 min</p>
              )}
            </div>
          )}

          {/* Current Bid Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-start">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Highest Bid</span>
              <span className="text-3xl font-black text-brand-accent">{formatCurrency(auction.currentHighestBid || auction.startingPrice || 0)}</span>
            </div>
            <div className="h-px bg-slate-800" />
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">Starting Price</span>
              <span className="font-bold text-slate-200">{formatCurrency(auction.startingPrice || 0)}</span>
            </div>
            {auction.reservePrice && isMine && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400 font-medium">Reserve Price</span>
                <span className="font-bold text-slate-200">{formatCurrency(auction.reservePrice)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">Min Increment</span>
              <span className="font-bold text-slate-200">{formatCurrency(auction.minBidIncrement || 1)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">Ends</span>
              <span className="font-bold text-slate-200 text-xs">{new Date(auction.endDate).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Product Description */}
          {auction.productDescription && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">About this Item</h3>
              <ul className="space-y-2">
                {String(auction.productDescription).split(',').filter((p: string) => p.trim()).map((pt: string, i: number) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="text-brand-accent font-bold mt-0.5">•</span>
                    <span className="text-slate-300 text-sm leading-relaxed">{pt.trim()}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ─── Right: Bid Panel + History ─── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Place Bid Card */}
          {isLive && !isMine && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <h2 className="text-lg font-black mb-1">Place Your Bid</h2>
              <p className="text-slate-400 text-sm mb-5">
                Minimum bid: <span className="font-bold text-brand-accent">{formatCurrency(minBid)}</span>
              </p>

              {bidSuccess && (
                <div className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-sm rounded-xl flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {bidSuccess}
                </div>
              )}
              {bidError && (
                <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-300 font-semibold text-sm rounded-xl flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  {bidError}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button
                  onClick={handlePlaceBid}
                  disabled={bidding || secondsRemaining === 0}
                  className="w-full py-5 bg-brand-accent hover:bg-brand-dark text-white font-black text-xl rounded-2xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl shadow-brand-accent/20"
                >
                  {bidding ? (
                    <div className="w-6 h-6 border-4 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : secondsRemaining === 0 ? (
                    <>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Auction Ending...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Place Bid for {formatCurrency(minBid)}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* If it's user's own auction */}
          {isMine && (
            <div className="bg-slate-900 border border-amber-500/20 rounded-3xl p-6">
              <p className="text-amber-400 font-bold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01" /></svg>
                This is your auction — you cannot place bids
              </p>
            </div>
          )}

          {/* Upcoming info */}
          {status === 'Upcoming' && (
            <div className="bg-slate-900 border border-blue-500/20 rounded-3xl p-6 text-center">
              <div className="w-14 h-14 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <p className="text-blue-300 font-bold mb-1">Auction starts on</p>
              <p className="text-white font-black text-xl">{new Date(auction.startDate).toLocaleString('en-IN')}</p>
              <p className="text-slate-400 text-sm mt-2">You&apos;ll be notified when it goes live.</p>
            </div>
          )}

          {/* ─── Bid History / My Bids Tabs ─── */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
            <div className="flex border-b border-slate-800">
              <button
                onClick={() => setActiveTab('bids')}
                className={`flex-1 py-4 text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'bids' ? 'text-brand-accent border-b-2 border-brand-accent' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Bid History
              </button>
              {!isMine && (
                <button
                  onClick={() => { setActiveTab('mine'); if (myBids.length === 0 || myBidPage > 1) { setMyBidPage(1); fetchMyBids(1); } }}
                  className={`flex-1 py-4 text-sm font-black uppercase tracking-widest transition-all ${activeTab === 'mine' ? 'text-brand-accent border-b-2 border-brand-accent' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  My Bids
                </button>
              )}
            </div>

            {activeTab === 'bids' && (
              <div ref={bidListRef} className="divide-y divide-slate-800/50 max-h-96 overflow-y-auto">
                {bidHistory.length === 0 && !bidsLoading ? (
                  <div className="py-12 text-center text-slate-500 text-sm font-medium">
                    No bids yet — be the first to bid!
                  </div>
                ) : bidHistory.map((bid: any, i: number) => (
                  <div key={bid.id || i} className={`flex items-center justify-between px-6 py-4 ${i === 0 ? 'bg-brand-accent/5' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${i === 0 ? 'bg-brand-accent text-white' : 'bg-slate-800 text-slate-400'}`}>
                        {i === 0 ? '★' : '•'}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white">{bid.maskedBidder || bid.MaskedBidder}</p>
                        <p className="text-slate-500 text-xs">{new Date(bid.placedAt || bid.PlacedAt).toLocaleTimeString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-black text-lg ${i === 0 ? 'text-brand-accent' : 'text-slate-200'}`}>
                        {formatCurrency(bid.amount || bid.Amount)}
                      </p>
                      {bid.status === 'Active' && i === 0 && (
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Leading</span>
                      )}
                    </div>
                  </div>
                ))}
                {bidHasMore && (
                  <div ref={bidObserverTarget} className="py-6 flex justify-center items-center">
                    <div className="w-6 h-6 border-2 border-slate-500 border-t-brand-accent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'mine' && (
              <div ref={myBidListRef} className="divide-y divide-slate-800/50 max-h-96 overflow-y-auto">
                {myBids.length === 0 && !myBidsLoading ? (
                  <div className="py-12 text-center text-slate-500 text-sm font-medium">
                    You haven&apos;t placed any bids yet
                  </div>
                ) : myBids.map((bid: any, i: number) => (
                  <div key={bid.id || i} className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${bid.isCurrentlyWinning ? 'bg-emerald-500 text-white' :
                        bid.status === 'Active' ? 'bg-brand-accent/30 text-brand-accent' :
                          'bg-slate-800 text-slate-500'
                        }`}>
                        {bid.isCurrentlyWinning ? '🏆' : '•'}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-white">{formatCurrency(bid.amount || bid.Amount)}</p>
                        <p className="text-slate-500 text-xs">{new Date(bid.placedAt || bid.PlacedAt).toLocaleTimeString('en-IN')}</p>
                      </div>
                    </div>
                    <div>
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${bid.isCurrentlyWinning ? 'bg-emerald-500/20 text-emerald-400' :
                        bid.status === 'Active' ? 'bg-brand-accent/20 text-brand-accent' :
                          bid.status === 'Won' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-800 text-slate-500'
                        }`}>
                        {bid.isCurrentlyWinning ? 'Winning' : (bid.status || bid.Status)}
                      </span>
                    </div>
                  </div>
                ))}
                {myBidHasMore && (
                  <div ref={myBidObserverTarget} className="py-6 flex justify-center items-center">
                    <div className="w-6 h-6 border-2 border-slate-500 border-t-amber-500 rounded-full animate-spin" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
