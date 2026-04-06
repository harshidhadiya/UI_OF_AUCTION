'use client';
import { useState, useEffect, useRef } from 'react';
import { api, ApiResponse } from '@/lib/api';
import { auth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import AdminNavbar from '@/components/AdminNavbar';

export default function AdminDashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [verifiedRequests, setVerifiedRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'mine' | 'all'>('pending');
  const [searchName, setSearchName] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchTrigger, setSearchTrigger] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [is404, setIs404] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      let user = auth.getUser();

      // If user is missing (e.g. page refresh), try admin refresh
      if (!user) {
        const refreshed = await auth.refreshAdmin();
        if (!refreshed) {
          router.push('/login');
          return;
        }
        user = auth.getUser();
      }

      if (!user || user.role !== 'ADMIN') {
        router.push('/login');
        return;
      }
      fetchFilterData(page > 1);
    };
    init();
  }, [page, activeTab, searchTrigger]);

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

    return () => {
      if (currentTarget) observer.unobserve(currentTarget);
    };
  }, [loading, hasMore]);

  const fetchFilterData = async (isLoadMore = false) => {
    setLoading(true);
    if (!isLoadMore) setIs404(false);

    const filterPayload = {
      name: searchName || undefined,
      email: searchEmail || undefined,
      from: activeTab !== 'pending' && searchFrom ? new Date(searchFrom).toLocaleString('sv-SE').replace(' ', 'T') : undefined,
      to: activeTab !== 'pending' && searchTo ? new Date(searchTo).toLocaleString('sv-SE').replace(' ', 'T') : undefined,
      pending: activeTab === 'pending',
      mine: activeTab === 'mine',
      page: page,
      pageSize: 10
    };

    try {
      const res = await api.post(`/api/admin-request/filter`, filterPayload, false);

      if (res.success) {
        const dataArr = (res.data as any[]) || [];
        setHasMore(dataArr.length === 10);
        if (activeTab === 'pending') {
          setRequests(prev => isLoadMore ? [...prev, ...dataArr] : dataArr);
        } else {
          setVerifiedRequests(prev => isLoadMore ? [...prev, ...dataArr] : dataArr);
        }
      } else {
        if (res.statusCode === 404 || (res.data && (res.data as any[]).length === 0) || res.message?.includes("done fetching")) {
          if (!isLoadMore) {
            if (activeTab === 'pending') {
              setIs404(true);
              setRequests([]);
            } else {
              setVerifiedRequests([]);
            }
          }
          setHasMore(false);
        } else {
          showNotification(res.message || "Failed to fetch requests", 'error');
          if (!isLoadMore) {
            if (activeTab === 'pending') setRequests([]);
            else setVerifiedRequests([]);
          }
        }
      }
    } catch (err) {
      console.error(err);
      showNotification("Network error. Please try again.", 'error');
      if (!isLoadMore) {
        if (activeTab === 'pending') setRequests([]);
        else setVerifiedRequests([]);
      }
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (page !== 1) setPage(1);
    setSearchTrigger(prev => !prev);
  };

  const handleClear = () => {
    setSearchName('');
    setSearchEmail('');
    setSearchFrom('');
    setSearchTo('');
    if (page !== 1) setPage(1);
    setSearchTrigger(prev => !prev);
  };

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchUserDetails = async (userid: number) => {
    try {
      const res = await api.get(`/api/admin/profile?userid=${userid}`);
      if (res.success) {
        setSelectedUser(res.data);
        setIsModalOpen(true);
      } else {
        showNotification(res.message || "Could not load user details", 'error');
      }
    } catch (err) {
      showNotification("Error fetching details", 'error');
    }
  };

  const handleAction = async (endpoint: string, successMsg: string) => {
    setIsActionLoading(true);
    try {
      const res = await api.get(`${endpoint}`);
      if (res.success) {
        showNotification(res.message || successMsg, 'success');
        setIsModalOpen(false);
        fetchFilterData();
      } else {
        showNotification(res.message || "Action failed", 'error');
      }
    } catch (err) {
      showNotification("Communication with server failed", 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-light relative overflow-x-hidden pb-12">
      {/* Decorative background Elements */}
      <div className="yellow-blob" />
      <div className="absolute top-40 left-0 w-[400px] h-[400px] bg-brand-accent/10 rounded-full blur-[80px] -translate-x-1/2 pointer-events-none" />

      <AdminNavbar />

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-32 lg:pt-36 relative z-10">

        {/* Header Section */}
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10 p-8 md:p-10 -ml-4 -mr-4 md:m-0 md:rounded-[2.5rem] bg-white border border-border shadow-xl shadow-slate-200/50">
          <div className="relative z-10 w-full max-w-2xl">
            <span className="inline-block py-1.5 px-3 rounded-full bg-[#FFF9D6] text-amber-700 font-black text-[10px] uppercase tracking-widest mb-4 border border-[#FDE68A]">
              ADMIN GATEWAY
            </span>
            <h2 className="display-heading text-5xl md:text-6xl text-brand-dark mb-4 animate-text-reveal">
              {activeTab === 'pending' ? 'Pending Verifications' : activeTab === 'mine' ? 'My Verified Activity' : 'Verified Archive'}
            </h2>
            <p className="text-slate-500 font-medium text-lg leading-relaxed">
              {activeTab === 'pending'
                ? 'Review and verify new administrator registration requests for core system access.'
                : activeTab === 'mine'
                  ? 'Historical log of identity verifications and rights you have actively granted.'
                  : 'Complete global directory of all verified administrative users within the system.'}
            </p>
          </div>

          <div className="flex bg-brand-light p-1.5 rounded-full border border-border self-start shadow-inner">
            <button
              onClick={() => { setActiveTab('pending'); handleClear(); }}
              className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-full ${activeTab === 'pending' ? 'bg-white text-brand-dark shadow-md scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 scale-95 hover:scale-100'}`}
            >
              Pending
            </button>
            <button
              onClick={() => { setActiveTab('mine'); handleClear(); }}
              className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-full ${activeTab === 'mine' ? 'bg-white text-brand-dark shadow-md scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 scale-95 hover:scale-100'}`}
            >
              My Verified
            </button>
            <button
              onClick={() => { setActiveTab('all'); handleClear(); }}
              className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-full ${activeTab === 'all' ? 'bg-white text-brand-dark shadow-md scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50 scale-95 hover:scale-100'}`}
            >
              All Verified
            </button>
          </div>
        </header>

        {/* Filter Bar */}
        <div className="bg-white p-6 pr-6 rounded-[2rem] shadow-sm border border-border mb-8 flex flex-col md:flex-row flex-wrap gap-4 items-end relative z-20">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Name / Identity</label>
            <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)} placeholder="Search by name" className="premium-input" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Global Email</label>
            <input type="text" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="Search by email" className="premium-input" />
          </div>
          {activeTab !== 'pending' && (
            <>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">From Timeline</label>
                <input type="date" value={searchFrom} onChange={e => setSearchFrom(e.target.value)} className="premium-input" />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">To Timeline</label>
                <input type="date" value={searchTo} onChange={e => setSearchTo(e.target.value)} className="premium-input" />
              </div>
            </>
          )}
          <div className="flex gap-3 w-full md:w-auto mt-4 md:mt-0">
            <button onClick={handleClear} className="premium-button bg-slate-100 text-slate-500 hover:bg-slate-200">
              Clear
            </button>
            <button onClick={handleSearch} className="premium-button">
              Search
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading && requests.length === 0 && verifiedRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white/50 backdrop-blur-md rounded-[3rem] shadow-sm border border-slate-100/50">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-6 shadow-sm" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Syncing with secure vault...</p>
          </div>
        ) : activeTab === 'pending' ? (
          is404 || requests.length === 0 ? (
            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200/50 rounded-[3rem] p-24 text-center shadow-inner overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 group-hover:scale-110 transition-all duration-500">
                <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              </div>
              <div className="w-24 h-24 bg-yellow-400 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-yellow-400/30">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h3 className="text-3xl font-black text-yellow-800 mb-3 tracking-tighter uppercase relative z-10">Dashboard Clear</h3>
              <p className="text-yellow-700/80 font-medium text-lg max-w-sm mx-auto relative z-10">Zero pending verifications discovered. The perimeter is secure.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {requests.map((req: any) => (
                <VerificationCard key={req.id} req={req} onViewDetail={() => fetchUserDetails(req.requestUserId)} />
              ))}
            </div>
          )
        ) : (
          verifiedRequests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {verifiedRequests.map((req: any) => (
                <VerificationCard key={req.id} req={req} onViewDetail={() => fetchUserDetails(req.requestUserId || req.id)} isHistory />
              ))}
            </div>
          ) : !loading && (
            <div className="bg-white/80 backdrop-blur-sm rounded-[3rem] p-24 text-center shadow-sm border border-slate-100 flex flex-col items-center">
              <div className="w-24 h-24 bg-slate-50 rounded-[2rem] border border-slate-100 flex items-center justify-center mb-6 shadow-inner">
                <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">No Verification History</h3>
              <p className="text-slate-500 font-medium text-lg">There are no verified requests to display for the current criteria.</p>
            </div>
          )
        )}

        {/* Load More Trigger */}
        {(requests.length > 0 || verifiedRequests.length > 0) && (
          hasMore ? (
            <div ref={observerTarget} className="flex justify-center py-16 mt-4">
              {loading && <div className="w-8 h-8 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin" />}
            </div>
          ) : (
            <div className="text-center py-16 mt-4 opacity-50">
              <span className="w-12 h-1 bg-slate-200 block mx-auto rounded-full mb-4"></span>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">End of securely fetched records</p>
            </div>
          )
        )}

        {/* Global Notifications */}
        {notification && (
          <div className={`fixed bottom-8 right-8 p-5 rounded-[1.5rem] shadow-2xl z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 flex items-center min-w-[300px] border ${notification.type === 'error' ? 'bg-white border-red-100 shadow-red-500/20' : 'bg-slate-900 border-slate-800 shadow-slate-900/30'}`}>
            <div className={`w-10 h-10 rounded-xl mr-4 flex items-center justify-center flex-shrink-0 ${notification.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {notification.type === 'error'
                ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              }
            </div>
            <div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${notification.type === 'error' ? 'text-red-500' : 'text-slate-400'}`}>
                {notification.type === 'error' ? 'System Alert' : 'Operation Success'}
              </p>
              <p className={`font-bold mt-0.5 ${notification.type === 'error' ? 'text-slate-900' : 'text-white'}`}>{notification.msg}</p>
            </div>
          </div>
        )}

        <DetailsModal
          isOpen={isModalOpen}
          user={selectedUser}
          onClose={() => setIsModalOpen(false)}
          onVerify={() => handleAction(`/api/admin-request/verify/${selectedUser?.id}`, 'Account securely verified.')}
          onGrant={() => handleAction(`/api/admin-request/grant-rights/${selectedUser?.id}`, 'System posting rights granted.')}
          onRevokeRights={() => handleAction(`/api/admin-request/revoke-rights/${selectedUser?.id}`, 'System posting rights revoked.')}
          onRevokeVerification={() => handleAction(`/api/admin-request/revoke-verification/${selectedUser?.id}`, 'Account verification revoked.')}
          loading={isActionLoading}
        />

      </main>
    </div>
  );
}

function VerificationCard({ req, onViewDetail, isHistory }: { req: any, onViewDetail: () => void, isHistory?: boolean }) {
  return (
    <div className="bg-white p-7 rounded-[2.5rem] relative overflow-hidden group hover:shadow-2xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 border border-slate-100 flex flex-col h-full active:scale-[0.98]">
      {(req.verifiedByAdmin || isHistory) && (
        <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black px-4 py-1.5 rounded-bl-[1.5rem] uppercase tracking-widest shadow-lg shadow-emerald-500/20">
          {isHistory ? 'MY VERIFIED' : 'VERIFIED'}
        </div>
      )}

      <div className="flex items-center gap-5 mb-6">
        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black text-2xl uppercase overflow-hidden shadow-inner flex-shrink-0 group-hover:scale-110 transition-transform duration-500">
          {req.imageUrl ? <img src={req.imageUrl} className="w-full h-full object-cover" /> : (req.name?.charAt(0) || req.email?.charAt(0))}
        </div>
        <div className="min-w-0 pr-4">
          <h4 className="font-black text-lg text-slate-900 leading-tight truncate">{req.name || 'Anonymous User'}</h4>
          <p className="text-[10px] font-black text-brand-accent uppercase tracking-widest mt-1">{req.role || 'ADMIN'}</p>
        </div>
      </div>

      <div className="space-y-5 flex-1 flex flex-col justify-end">
        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100/50 flex flex-col gap-4">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Email Identity</span>
            <span className="text-slate-800 font-bold text-sm truncate block">{req.email}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200/50">
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Post Rights</span>
              {req.hasRightToAdd
                ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-xs font-black uppercase tracking-wider border border-emerald-100">Granted</span>
                : <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-xs font-black uppercase tracking-wider border border-slate-200">Denied</span>
              }
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Verification</span>
              {req.verifiedByAdmin
                ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-xs font-black uppercase tracking-wider border border-blue-100">Approved</span>
                : <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-xs font-black uppercase tracking-wider border border-slate-200">Pending</span>
              }
            </div>
          </div>
        </div>

        <button onClick={onViewDetail} className="w-full py-4 mt-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-[1.5rem] hover:bg-brand-accent transition-all shadow-xl shadow-slate-900/20 active:scale-95 group-hover:shadow-brand-accent/30">
          Inspect Profile
        </button>
      </div>
    </div>
  );
}

function DetailsModal({ isOpen, user, onClose, onVerify, onGrant, onRevokeRights, onRevokeVerification, loading }: any) {
  const [verifierLoading, setVerifierLoading] = useState(false);
  const [verifierDetail, setVerifierDetail] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setVerifierDetail(null);
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const currentAdmin = auth.getUser();
  const isSelf = currentAdmin?.id === (user.requestUserId || user.id);
  const isVerifier = user.obj?.verifierId === currentAdmin?.userId || user.obj?.verifierId === currentAdmin?.id;

  const fetchVerifierDetail = async () => {
    try {
      setVerifierLoading(true);
      const res = await api.get(`/api/admin-request/details/${user.verifierId || user.id}`);
      if (res.success && res.data) {
        setVerifierDetail(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVerifierLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-[flex-start] justify-center px-4 pt-28 pb-8 md:px-6 bg-slate-900/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-[3rem] shadow-2xl shadow-black max-w-2xl w-full border border-slate-700/50 relative overflow-hidden animate-in zoom-in-95 fade-in duration-300">

        {/* Header Art */}
        <div className="absolute top-0 right-0 w-64 h-32 bg-gradient-to-l from-red-500/10 to-transparent pointer-events-none rounded-tr-[3rem]" />

        <header className="h-28 bg-slate-900 flex items-end justify-between px-10 pb-6 relative z-10">
          <h3 className="text-2xl font-black text-white tracking-tighter">Security Dossier</h3>
          <button onClick={onClose} className="w-10 h-10 bg-white/10 hover:bg-white/20 hover:scale-110 active:scale-90 rounded-2xl text-white flex items-center justify-center transition-all backdrop-blur-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <div className="p-10 pt-12">
          {/* Identity Section */}
          <div className="flex flex-col sm:flex-row gap-8 mb-10 items-start sm:items-center">
            <div className="w-28 h-28 bg-slate-50 border-4 border-white shadow-xl rounded-[2rem] flex items-center justify-center text-slate-300 overflow-hidden flex-shrink-0 -mt-16 sm:-mt-20 z-20 relative">
              {user.imageUrl
                ? <img src={user.imageUrl} className="w-full h-full object-cover" />
                : <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              }
            </div>
            <div className="flex-1 pt-2 sm:pt-0">
              <h4 className="text-4xl font-black text-slate-900 tracking-tighter mb-1 leading-none">{user.name}</h4>
              <p className="text-slate-500 font-bold mb-4">{user.email}</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-slate-900 rounded-xl text-[10px] font-black text-white uppercase tracking-widest">{user.role}</span>
                {user.obj?.verifiedByAdmin && <span className="px-3 py-1 bg-emerald-100 rounded-xl text-[10px] font-black text-emerald-700 uppercase tracking-widest border border-emerald-200">System Verified</span>}
              </div>
            </div>
          </div>

          {/* Intel Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 shadow-inner">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Direct Line</span>
              <p className="text-slate-900 font-bold truncate">{user.phone || 'Classified / Unknown'}</p>
            </div>
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Registered Base</span>
              <p className="text-slate-900 font-bold truncate">{user.address || 'Classified / Unknown'}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white border-2 border-slate-100 p-6 rounded-[2rem]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Audit Trail</p>
              <ul className="space-y-3">
                <li className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                  <span className="text-xs font-bold text-slate-500">Onboarding Timestamp</span>
                  <span className="text-sm font-black text-slate-800">{user.obj?.createdAt ? new Date(user.obj.createdAt).toLocaleString() : 'N/A'}</span>
                </li>
                <li className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                  <span className="text-xs font-bold text-slate-500">Publishing Authority</span>
                  <span className={`text-[10px] px-3 py-1 rounded-lg font-black uppercase tracking-widest ${user.obj?.hasRightToAdd ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {user.obj?.hasRightToAdd ? 'Enabled' : 'Restricted'}
                  </span>
                </li>
              </ul>
            </div>

            {isSelf ? (
              <div className="bg-red-50 text-red-600 p-6 rounded-[2rem] font-bold text-center border-2 border-red-100 flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                Identity Conflict: Cannot perform security operations on own account.
              </div>
            ) : !currentAdmin?.requestObj?.hasRightToAdd ? (
              <div className="bg-red-50 text-red-600 p-6 rounded-[2rem] font-bold text-center border-2 border-red-100 flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                Clearance Level Insufficient: You lack "Publishing Authority" required to promote or verify other administrators.
              </div>
            ) : (
              <div className="flex flex-col gap-4 pt-2">
                <div className="flex flex-col sm:flex-row gap-4">
                  {!user.obj?.verifiedByAdmin && (
                    <button
                      onClick={onVerify}
                      disabled={loading}
                      className="flex-1 bg-brand-accent text-white hover:bg-brand-dark py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-accent/30 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:grayscale"
                    >
                      {loading ? <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                      Approve Clearance
                    </button>
                  )}
                  {isVerifier && !user.obj?.hasRightToAdd && (
                    <button
                      onClick={onGrant}
                      disabled={loading}
                      className="flex-1 bg-slate-900 text-white hover:bg-black py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-900/30 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:grayscale"
                    >
                      {loading ? <div className="w-5 h-5 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                      Grant Publishing Rights
                    </button>
                  )}
                </div>

                {!isVerifier && user.obj?.verifiedByAdmin && (
                  <div className="p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Operation locked</p>
                      <span className="w-2 h-2 bg-slate-300 rounded-full" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">Account verified by another administrative entity.</p>

                    {!verifierDetail ? (
                      <button
                        onClick={fetchVerifierDetail}
                        disabled={verifierLoading}
                        className="w-full bg-white text-slate-900 border-2 border-slate-200 hover:border-slate-400 py-4 rounded-[1.25rem] font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex justify-center items-center gap-3 mt-2"
                      >
                        {verifierLoading ? <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" /> : null}
                        Request Approver Identity
                      </button>
                    ) : (
                      <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm mt-2 flex flex-col gap-1">
                        <span className="text-[9px] font-black text-brand-accent uppercase tracking-widest block mb-1">Approving Officer Intel</span>
                        <p className="text-slate-900 font-bold">{verifierDetail.name || verifierDetail.verifierName || 'Identity Classified'}</p>
                        <p className="text-slate-500 font-medium text-sm">{verifierDetail.email || verifierDetail.verifierEmail || 'No comms channel listed'}</p>
                      </div>
                    )}
                  </div>
                )}

                {isVerifier && user.obj?.verifiedByAdmin && (
                  <div className="flex flex-col sm:flex-row gap-4 pt-6 mt-4 border-t-2 border-dashed border-slate-200">
                    <button
                      onClick={onRevokeVerification}
                      disabled={loading}
                      className="flex-1 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-100 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 disabled:grayscale"
                    >
                      {loading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
                      Revoke Clearance
                    </button>
                    {user.obj?.hasRightToAdd && (
                      <button
                        onClick={onRevokeRights}
                        disabled={loading}
                        className="flex-1 bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white border border-orange-100 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 disabled:grayscale"
                      >
                        {loading ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : null}
                        Revoke Publishing
                      </button>
                    )}
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
