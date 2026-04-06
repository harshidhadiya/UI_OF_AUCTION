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
  const [auctionStartedToast, setAuctionStartedToast] = useState<{ id: string; name: string } | null>(null);
  const bidListRef = useRef<HTMLDivElement>(null);
  const myBidListRef = useRef<HTMLDivElement>(null);
  const win = useRef(false);

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
      const auctionRes = await api.get(`/api/auctions/${id}`);
      console.log(auctionRes);

      if (auctionRes.success && auctionRes.data) {
        const a = auctionRes.data as any;
        console.log(a);

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
                const userRes = await api.get(`/api/User/profile?id=${winnerId}`);
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

        setViewerCount(prev => prev !== null ? prev : (a.liveViewerCount || 0));
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
      const res = await api.get(`/api/auctions/${id}/bids?page=${pageToFetch}&pageSize=10&size=10&mine=false`);
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
      const res = await api.get(`/api/auctions/${id}/bids?page=${pageToFetch}&pageSize=10&size=10&mine=true`);
      console.log(res)
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
    const conn = await getAuctionConnection();
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
    conn.on('AuctionStarted', (data: { auctionId: number }) => {
      console.log("AuctionStarted", data)
      const id = String(data.auctionId);

      const name = "good";
      setAuctionStartedToast({ id, name });
      setTimeout(() => setAuctionStartedToast(null), 8000);
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
      console.log("Viewer Count Updated", count);
      setViewerCount(count);
    });

    // Join auction room
    if (!joinedRef.current) {
      console.log("entered here more then")
      await joinAuctionRoomSafe(conn, String(id));
      joinedRef.current = true;
    }
  }, [id]);

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

      // 1. Establish Real-Time Socket FIRST to synchronize viewer count silently
      await setupSignalR();

      // 2. Fetch full auction state
      fetchAuction().then(status => {
        fetchBids(1);
        fetchMyBids(1);

        // 3. If closed or cancelled, safely leave the room instead.
        if (status === 'Ended' || status === 'Cancelled' || status === 'UnVerified') {
          getAuctionConnection().then(conn => {
            if (conn && joinedRef.current) {
              leaveAuctionRoomSafe(conn, String(id));
              joinedRef.current = false;
            }
          });
        }
      });
    };
    init();

    // Cleanup: leave room on unmount
    return () => {
      getAuctionConnection().then(conn => {
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
      const res = await api.post(`/api/auctions/${id}/bids`, { amount: minBidAmount });
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
    <div className="min-h-screen bg-slate-950 relative overflow-x-hidden text-slate-100 pb-12">
      {auctionStartedToast && (
        <div className="fixed top-24 right-4 md:right-8 z-[999] animate-in fade-in slide-in-from-top-8 duration-500 pointer-events-auto">
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

      {/* Decorative background Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-accent/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 pointer-events-none" />

      {/* ─── Floating Top Nav ─── */}
      <nav className="fixed top-6 left-0 right-0 w-full px-4 md:px-8 z-50 transition-all duration-300 pointer-events-none">
        <div className="max-w-7xl mx-auto bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-2xl shadow-black/50 rounded-full pl-3 pr-6 py-3 flex justify-between items-center pointer-events-auto">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="w-10 h-10 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full flex items-center justify-center transition-all active:scale-95 text-white">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <div>
              <h1 className="font-black text-lg leading-tight text-white mb-0.5">{auction.productName || 'Live Auction'}</h1>
              <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest leading-none">REF: {id}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {viewerCount !== null && isLive && (
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-300 bg-white/5 border border-white/10 px-4 py-2 rounded-full shadow-inner">
                <svg className="w-3.5 h-3.5 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                <span className="text-white">{viewerCount}</span> watching
              </div>
            )}
            <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${isLive ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' :
              status === 'Upcoming' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' :
                status === 'Ended' ? 'bg-slate-800 text-slate-300 border-slate-700' :
                  'bg-gray-800 text-gray-300 border-gray-700'
              }`}>
              <span className="flex items-center gap-1.5">
                {isLive && <span className="w-2 h-2 bg-red-500 rounded-full inline-block shrink-0" />}
                {status}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* ─── Auction Closed Banner ─── */}
      <div className="pt-32 lg:pt-36 relative z-10 w-full max-w-7xl mx-auto px-4 md:px-8">
        {isClosed && (
          <div className={`${auction?.status === 'Cancelled' ? 'bg-slate-900 border-slate-800' : 'bg-gradient-to-r from-amber-500/10 to-amber-600/5 border-amber-500/20'} border rounded-[2.5rem] px-8 py-6 mb-8 backdrop-blur-md shadow-xl`}>
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center shrink-0 border border-amber-500/30">
                <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div className="flex-1">
                {winner?.finalPrice && auction.status == "Ended" ? (
                  <>
                    <p className="font-black text-amber-400 text-2xl tracking-tight mb-1">🏁 Auction Closed — Winner Declared</p>
                    <p className="text-amber-200 text-sm font-medium">Winning bid: <span className="font-black text-amber-400 text-lg">{formatCurrency(winner.finalPrice || winner.FinalPrice)}</span></p>

                    {(isMine || String(currentUser?.id) === String(winner?.winnerUserId || winner?.WinnerUserId || winner?.winnerId)) && (
                      <div className="mt-6 bg-slate-950/50 rounded-2xl p-6 border border-amber-500/20 shadow-inner max-w-3xl">
                        <h4 className="text-amber-400 font-bold mb-4 flex items-center gap-2 text-sm uppercase tracking-widest">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                          Winner Details ({isMine ? 'Owner View' : 'Your Winning Details'})
                        </h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8 text-sm">
                          <div>
                            <p className="text-amber-500/70 text-[10px] font-black uppercase tracking-widest mb-1.5">Winner ID</p>
                            <p className="font-bold text-white text-base">{winner.winnerUserId || winner.WinnerUserId || winner.winnerId || winner.WinnerId || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-amber-500/70 text-[10px] font-black uppercase tracking-widest mb-1.5">Final Amount</p>
                            <p className="font-black text-emerald-400 text-xl">{formatCurrency(winner.finalPrice || winner.FinalPrice)}</p>
                          </div>
                          {(winner.winnerName || winner.WinnerName) && (
                            <div className="col-span-2">
                              <p className="text-amber-500/70 text-[10px] font-black uppercase tracking-widest mb-1.5">Name</p>
                              <p className="font-bold text-white text-base">{winner.winnerName || winner.WinnerName}</p>
                            </div>
                          )}
                          {(winner.winnerEmail || winner.WinnerEmail) && (
                            <div className="col-span-2">
                              <p className="text-amber-500/70 text-[10px] font-black uppercase tracking-widest mb-1.5">Email</p>
                              <p className="font-bold text-white text-base">{winner.winnerEmail || winner.WinnerEmail}</p>
                            </div>
                          )}
                          {(winner.winnerPhone || winner.WinnerPhone) && (
                            <div className="col-span-2">
                              <p className="text-amber-500/70 text-[10px] font-black uppercase tracking-widest mb-1.5">Phone</p>
                              <p className="font-bold text-white text-base">{winner.winnerPhone || winner.WinnerPhone}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : auction.win && auction.status != "Cancelled" ? (
                  <p className="font-black text-amber-400 text-2xl tracking-tight mb-1">🏁 Auction Closed — Winner Declared</p>
                ) : auction.status == "Cancelled" ? (
                  <p className="font-black text-2xl tracking-tight text-slate-300">❌ Auction Cancelled</p>
                ) : (
                  <p className="font-black text-amber-400 text-2xl tracking-tight mb-1">🏁 Auction Closed — No Winner Declared</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Auction Messages ─── */}
        {auctionMessages.length > 0 && (
          <div className="mb-6">
            {auctionMessages.slice(0, 2).map((msg, i) => (
              <div key={i} className="mb-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-widest px-6 py-4 rounded-2xl shadow-inner backdrop-blur-md">
                {msg}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
          {/* ─── Left: Auction Info + Timer ─── */}
          <div className="lg:col-span-1 space-y-8 relative z-10 w-full">
            {/* Timer */}
            {isLive && (
              <div className={`rounded-[2.5rem] p-8 border text-center transition-colors shadow-2xl backdrop-blur-md ${secondsRemaining < 120 ? 'bg-red-950/40 border-red-500/40 shadow-red-900/20' : 'bg-slate-900/60 border-white/10'}`}>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">Time Remaining</p>
                <div className={`text-6xl font-black tabular-nums tracking-tighter mb-2 ${secondsRemaining < 120 ? 'text-red-500' : 'text-white'}`}>
                  {secondsRemaining > 0 ? formatTime(secondsRemaining) : 'Ending...'}
                </div>
                {secondsRemaining < 120 && secondsRemaining > 0 && (
                  <p className="text-red-400 text-[10px] font-black uppercase tracking-widest animate-pulse mt-3 bg-red-500/10 py-2 rounded-xl border border-red-500/20">⚡ Bid extends by 2 min</p>
                )}
              </div>
            )}

            {/* Current Bid Info */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-[2.5rem] p-8 space-y-5 shadow-xl">
              <div className="flex justify-between items-end pb-4 border-b border-white/5">
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Highest Bid</span>
                <span className="text-4xl font-black text-brand-accent tracking-tighter">{formatCurrency(auction.currentHighestBid || auction.startingPrice || 0)}</span>
              </div>
              <div className="space-y-4 pt-2">
                <div className="flex justify-between items-center text-sm bg-white/5 p-4 rounded-[1.25rem]">
                  <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Starting Price</span>
                  <span className="font-black text-white text-base tracking-wide">{formatCurrency(auction.startingPrice || 0)}</span>
                </div>
                {auction.reservePrice && isMine && (
                  <div className="flex justify-between items-center text-sm bg-white/5 p-4 rounded-[1.25rem]">
                    <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Reserve Price</span>
                    <span className="font-black text-white text-base tracking-wide">{formatCurrency(auction.reservePrice)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm bg-white/5 p-4 rounded-[1.25rem]">
                  <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Min Increment</span>
                  <span className="font-black text-white text-base tracking-wide">{formatCurrency(auction.minBidIncrement || 1)}</span>
                </div>
                <div className="flex justify-between items-center text-sm bg-white/5 p-4 rounded-[1.25rem]">
                  <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Ends</span>
                  <span className="font-black text-white text-xs">{new Date(auction.endDate).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Product Description */}
            {auction.productDescription && (
              <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-[2.5rem] p-8 shadow-xl">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6">About this Item</h3>
                <ul className="space-y-3">
                  {String(auction.productDescription).split(',').filter((p: string) => p.trim()).map((pt: string, i: number) => (
                    <li key={i} className="flex gap-3 items-start bg-white/5 p-4 rounded-[1.25rem]">
                      <span className="text-brand-accent font-black mt-0.5">•</span>
                      <span className="text-slate-300 text-sm leading-relaxed font-medium">{pt.trim()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* ─── Right: Bid Panel + History ─── */}
          <div className="lg:col-span-2 space-y-8 relative z-10 w-full">
            {/* Place Bid Card */}
            {isLive && !isMine && (
              <div className="bg-slate-900/60 backdrop-blur-md border border-brand-accent/30 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-accent/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />

                <h2 className="text-3xl font-black mb-2 text-white">Place Your Bid</h2>
                <p className="text-slate-400 font-medium text-sm mb-8">
                  Minimum required bid: <span className="font-black text-brand-accent text-lg">{formatCurrency(minBid)}</span>
                </p>

                {bidSuccess && (
                  <div className="mb-6 px-6 py-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-xs uppercase tracking-widest rounded-2xl flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    {bidSuccess}
                  </div>
                )}
                {bidError && (
                  <div className="mb-6 px-6 py-4 bg-red-500/10 border border-red-500/30 text-red-400 font-black text-xs uppercase tracking-widest rounded-2xl flex items-center gap-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    {bidError}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={handlePlaceBid}
                    disabled={bidding || secondsRemaining === 0}
                    className="w-full py-5 bg-brand-accent hover:bg-brand-dark text-white font-black text-lg uppercase tracking-widest rounded-[1.5rem] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-xl active:scale-95 border border-brand-accent/50 hover:border-brand-accent relative z-10"
                  >
                    {bidding ? (
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                        Wait...
                      </div>
                    ) : secondsRemaining === 0 ? (
                      <>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Auction Ending...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Bid {formatCurrency(minBid)}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* If it's user's own auction */}
            {isMine && (
              <div className="bg-slate-900/60 backdrop-blur-md border border-amber-500/30 rounded-[2.5rem] p-8 shadow-xl">
                <p className="text-amber-400 font-bold flex items-center gap-3 text-lg">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01" /></svg>
                  This is your auction — you cannot place bids
                </p>
              </div>
            )}

            {/* Upcoming info */}
            {status === 'Upcoming' && (
              <div className="bg-slate-900/60 backdrop-blur-md border border-blue-500/30 rounded-[2.5rem] p-12 text-center shadow-xl">
                <div className="w-20 h-20 bg-blue-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-inner">
                  <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-blue-300 font-black text-sm uppercase tracking-widest mb-2">Auction starts on</p>
                <p className="text-white font-black text-3xl mb-4">{new Date(auction.startDate).toLocaleString('en-IN')}</p>
                <p className="text-slate-400 font-medium">You&apos;ll be notified when it goes live.</p>
              </div>
            )}

            {/* ─── Bid History / My Bids Tabs ─── */}
            <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-[2.5rem] overflow-hidden shadow-xl">
              <div className="flex border-b border-white/10 bg-white/5">
                <button
                  onClick={() => setActiveTab('bids')}
                  className={`flex-1 py-5 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'bids' ? 'text-brand-accent bg-white/5 border-b-2 border-brand-accent' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                >
                  Bid History
                </button>
                {!isMine && (
                  <button
                    onClick={() => { setActiveTab('mine'); if (myBids.length === 0 || myBidPage > 1) { setMyBidPage(1); fetchMyBids(1); } }}
                    className={`flex-1 py-5 text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'mine' ? 'text-brand-accent bg-white/5 border-b-2 border-brand-accent' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                  >
                    My Bids
                  </button>
                )}
              </div>

              {activeTab === 'bids' && (
                <div ref={bidListRef} className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                  {bidHistory.length === 0 && !bidsLoading ? (
                    <div className="py-20 text-center text-slate-500 font-medium bg-slate-900/20">
                      <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      </div>
                      No bids yet — be the first to bid!
                    </div>
                  ) : bidHistory.map((bid: any, i: number) => (
                    <div key={bid.id || i} className={`flex items-center justify-between px-8 py-5 transition-colors ${i === 0 ? 'bg-brand-accent/5' : 'hover:bg-white/5'}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-[1.25rem] flex items-center justify-center text-xs font-black shadow-inner border ${i === 0 ? 'bg-brand-accent text-white border-brand-accent/50' : 'bg-slate-800 text-slate-400 border-white/5'}`}>
                          {i === 0 ? '★' : `${i + 1}`}
                        </div>
                        <div>
                          <p className="font-bold text-base text-white">{bid.maskedBidder || bid.MaskedBidder}</p>
                          <p className="text-slate-500 text-xs font-medium">{new Date(bid.placedAt || bid.PlacedAt).toLocaleTimeString('en-IN')}</p>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end justify-center">
                        <p className={`font-black text-xl tracking-tight ${i === 0 ? 'text-brand-accent' : 'text-slate-200'}`}>
                          {formatCurrency(bid.amount || bid.Amount)}
                        </p>
                        {bid.status === 'Active' && i === 0 && (
                          <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase tracking-[0.2em] mt-1 border border-emerald-500/20">Leading</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {bidHasMore && (
                    <div ref={bidObserverTarget} className="py-8 flex justify-center items-center">
                      <div className="w-8 h-8 border-4 border-slate-700 border-t-brand-accent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'mine' && (
                <div ref={myBidListRef} className="divide-y divide-white/5 max-h-[500px] overflow-y-auto bg-slate-900/20">
                  {myBids.length === 0 && !myBidsLoading ? (
                    <div className="py-20 text-center text-slate-500 font-medium">
                      <div className="w-16 h-16 bg-white/5 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </div>
                      You haven&apos;t placed any bids yet
                    </div>
                  ) : myBids.map((bid: any, i: number) => (
                    <div key={bid.id || i} className="flex items-center justify-between px-8 py-5 hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-[1.5rem] flex items-center justify-center text-xs font-black shadow-inner border ${bid.isCurrentlyWinning ? 'bg-emerald-500 text-white border-emerald-400' :
                          bid.status === 'Active' ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/30' :
                            'bg-slate-800 text-slate-500 border-white/5'
                          }`}>
                          {bid.isCurrentlyWinning ? '🏆' : `${i + 1}`}
                        </div>
                        <div>
                          <p className="font-black text-lg text-white tracking-tight">{formatCurrency(bid.amount || bid.Amount)}</p>
                          <p className="text-slate-500 text-xs font-medium">{new Date(bid.placedAt || bid.PlacedAt).toLocaleTimeString('en-IN')}</p>
                        </div>
                      </div>
                      <div>
                        <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border ${bid.isCurrentlyWinning ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                          bid.status === 'Active' ? 'bg-brand-accent/10 text-brand-accent border-brand-accent/30' :
                            bid.status === 'Won' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                              'bg-slate-800 text-slate-500 border-slate-700'
                          }`}>
                          {bid.isCurrentlyWinning ? 'Winning' : (bid.status || bid.Status)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {myBidHasMore && (
                    <div ref={myBidObserverTarget} className="py-8 flex justify-center items-center">
                      <div className="w-8 h-8 border-4 border-slate-700 border-t-amber-500 rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
