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
      // endpoints are GET according to the reference and controller
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
    <div className="min-h-screen bg-slate-50 page-enter">
      <AdminNavbar />

      <main className="max-w-7xl mx-auto p-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-4xl font-extrabold text-slate-900 mb-2">
              {activeTab === 'pending' ? 'Pending Verifications' : activeTab === 'mine' ? 'My Verified Activity' : 'Verified Archive'}
            </h2>
            <p className="text-slate-500">
              {activeTab === 'pending'
                ? 'Review and verify user requests for system access.'
                : activeTab === 'mine'
                  ? 'History of identity verifications and rights you have granted.'
                  : 'Complete history of all verified users in the system.'}
            </p>
          </div>

          <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200/60 backdrop-blur-sm self-start">
            <button
              onClick={() => { setActiveTab('pending'); handleClear(); }}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'pending' ? 'bg-white text-slate-900 shadow-lg shadow-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Pending
            </button>
            <button
              onClick={() => { setActiveTab('mine'); handleClear(); }}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'mine' ? 'bg-white text-slate-900 shadow-lg shadow-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              My Verified
            </button>
            <button
              onClick={() => { setActiveTab('all'); handleClear(); }}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'all' ? 'bg-white text-slate-900 shadow-lg shadow-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              All Verified
            </button>
          </div>
        </header>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8 flex flex-col md:flex-row flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Name</label>
            <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)} placeholder="Search by name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-all text-sm" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Email</label>
            <input type="text" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="Search by email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-all text-sm" />
          </div>
          {activeTab !== 'pending' && (
            <>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">From Date</label>
                <input type="date" value={searchFrom} onChange={e => setSearchFrom(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-all text-sm text-slate-600" />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">To Date</label>
                <input type="date" value={searchTo} onChange={e => setSearchTo(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent focus:border-brand-accent outline-none transition-all text-sm text-slate-600" />
              </div>
            </>
          )}
          <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
            <button onClick={handleClear} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm w-full md:w-auto">
              Clear
            </button>
            <button onClick={handleSearch} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 text-sm w-full md:w-auto">
              Search
            </button>
          </div>
        </div>

        {loading && requests.length === 0 && verifiedRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400 font-medium tracking-wide">Syncing with secure vault...</p>
          </div>
        ) : activeTab === 'pending' ? (
          is404 || requests.length === 0 ? (
            <div className="bg-yellow-50 border-2 border-yellow-100 rounded-[2.5rem] p-24 text-center shadow-inner-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
                <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              </div>
              <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-yellow-200">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h3 className="text-3xl font-black text-yellow-800 mb-3 tracking-tight uppercase">Dashboard Clear</h3>
              <p className="text-yellow-700/80 font-bold text-lg max-w-sm mx-auto">Zero pending verifications discovered. Your inbox is clean!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {requests.map((req: any) => (
                <VerificationCard key={req.id} req={req} onViewDetail={() => fetchUserDetails(req.requestUserId)} />
              ))}
            </div>
          )
        ) : (
          verifiedRequests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {verifiedRequests.map((req: any) => (
                <VerificationCard key={req.id} req={req} onViewDetail={() => fetchUserDetails(req.requestUserId || req.id)} isHistory />
              ))}
            </div>
          ) : !loading && (
            <div className="bg-white rounded-[2.5rem] p-20 text-center shadow-sm border border-slate-100 flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">No Verification History</h3>
              <p className="text-slate-400">There are no verified requests to display.</p>
            </div>
          )
        )}

        {(requests.length > 0 || verifiedRequests.length > 0) && (
          hasMore ? (
            <div ref={observerTarget} className="flex justify-center py-12 mt-8">
              {loading && <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />}
            </div>
          ) : (
            <div className="text-center py-12 mt-8">
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">End of records</p>
            </div>
          )
        )}

        {notification && (
          <div className={`fixed bottom-8 right-8 p-4 rounded-xl shadow-2xl z-50 animate-slide-up ${notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
            <p className="font-bold flex items-center gap-2">
              {notification.type === 'error' ? 'Oops!' : 'Success!'}
              <span className="font-normal">{notification.msg}</span>
            </p>
          </div>
        )}

        <DetailsModal
          isOpen={isModalOpen}
          user={selectedUser}
          onClose={() => setIsModalOpen(false)}
          onVerify={() => handleAction(`/api/admin-request/verify/${selectedUser?.id}`, 'Account verified!')}
          onGrant={() => handleAction(`/api/admin-request/grant-rights/${selectedUser?.id}`, 'Rights granted!')}
          onRevokeRights={() => handleAction(`/api/admin-request/revoke-rights/${selectedUser?.id}`, 'Rights revoked!')}
          onRevokeVerification={() => handleAction(`/api/admin-request/revoke-verification/${selectedUser?.id}`, 'Verification revoked!')}
          loading={isActionLoading}
        />

      </main>
    </div>
  );
}

function VerificationCard({ req, onViewDetail, isHistory }: { req: any, onViewDetail: () => void, isHistory?: boolean }) {
  return (
    <div className="premium-card bg-white p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform border border-slate-100">
      {(req.verifiedByAdmin || isHistory) && (
        <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-widest shadow-lg">
          {isHistory ? 'MY VERIFIED' : 'VERIFIED'}
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center text-slate-400 font-bold text-xl uppercase overflow-hidden">
          {req.imageUrl ? <img src={req.imageUrl} className="w-full h-full object-cover" /> : (req.name?.charAt(0) || req.email?.charAt(0))}
        </div>
        <div>
          <h4 className="font-bold text-slate-900 leading-tight">{req.name || 'Anonymous User'}</h4>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-tighter">{req.role || 'ADMIN'}</p>
        </div>
      </div>

      <div className="space-y-4 text-sm">
        <div className="flex justify-between border-b border-slate-50 pb-2">
          <span className="text-slate-400">Email</span>
          <span className="text-slate-800 font-medium truncate ml-2">{req.email}</span>
        </div>

        <div className="pt-2 grid grid-cols-2 gap-3">
          <div className={`p-2 rounded-lg text-center ${req.hasRightToAdd ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
            <span className="text-[10px] block font-bold uppercase tracking-tight">Can Post</span>
            <span className="text-xs font-bold">{req.hasRightToAdd ? 'YES' : 'NO'}</span>
          </div>
          <div className={`p-2 rounded-lg text-center ${req.verifiedByAdmin ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
            <span className="text-[10px] block font-bold uppercase tracking-tight">Verified</span>
            <span className="text-xs font-bold">{req.verifiedByAdmin ? 'YES' : 'NO'}</span>
          </div>
        </div>

        <button onClick={onViewDetail} className="premium-button w-full mt-4 bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-lg">
          View Full Details
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
      // Using /api/admin-request/detail/{id} as requested
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <header className="h-24 bg-gradient-to-r from-slate-900 to-slate-800 flex items-end justify-between px-8 pb-4">
          <h3 className="text-2xl font-bold text-white">Review Request</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </header>

        <div className="p-8">
          <div className="flex gap-6 mb-8 items-center">
            <img src={user.imageUrl || 'https://via.placeholder.com/150'} className="w-24 h-24 rounded-2xl object-cover shadow-md" />
            <div>
              <h4 className="text-3xl font-extrabold text-slate-900">{user.name}</h4>
              <p className="text-slate-500 font-medium">{user.email}</p>
              <div className="mt-2 flex gap-2">
                <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600 uppercase tracking-widest">{user.role}</span>
                {user.obj?.verifiedByAdmin && <span className="px-3 py-1 bg-green-100 rounded-full text-xs font-bold text-green-700 uppercase tracking-widest">Verified</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Phone Number</span>
              <p className="text-slate-800 font-bold">{user.phone || 'Not Provided'}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Mailing Address</span>
              <p className="text-slate-800 font-bold">{user.address || 'Not Provided'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-700">
              <p className="font-bold mb-1">Status Report</p>
              <ul className="list-disc list-inside">
                <li>Created At: {user.obj?.createdAt ? new Date(user.obj.createdAt).toLocaleString() : 'N/A'}</li>
                <li>Rights Status: {user.obj?.hasRightToAdd ? 'Enabled' : 'Disabled'}</li>
              </ul>
            </div>

            {isSelf ? (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold text-center border border-red-100">
                You cannot verify yourself. Please have another admin review this request.
              </div>
            ) : !currentAdmin?.requestObj?.hasRightToAdd ? (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold text-center border border-red-100 mt-4">
                You do not have the required "can post/add" permission to manage other administrators.
              </div>
            ) : (
              <div className="flex flex-col gap-4 pt-4">
                <div className="flex gap-4">
                  {!user.obj?.verifiedByAdmin && (
                    <button
                      onClick={onVerify}
                      disabled={loading}
                      className="flex-1 premium-button bg-brand-accent text-white hover:bg-brand-dark py-4 shadow-xl shadow-brand-accent/20 flex items-center justify-center gap-2"
                    >
                      {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                      Verify Identity
                    </button>
                  )}
                  {isVerifier && !user.obj?.hasRightToAdd && (
                    <button
                      onClick={onGrant}
                      disabled={loading}
                      className="flex-1 premium-button bg-green-600 text-white hover:bg-green-700 py-4 shadow-xl shadow-green-600/20 flex items-center justify-center gap-2"
                    >
                      {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                      Grant Rights
                    </button>
                  )}
                </div>

                {!isVerifier && user.obj?.verifiedByAdmin && (
                  <div className="pt-4 border-t border-slate-100 flex flex-col gap-4">
                    <p className="text-sm font-bold text-slate-500">Verified by another admin</p>
                    {!verifierDetail ? (
                      <button
                        onClick={fetchVerifierDetail}
                        disabled={verifierLoading}
                        className="w-full premium-button bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 py-4 shadow-sm flex items-center justify-center gap-2"
                      >
                        {verifierLoading ? <div className="w-5 h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" /> : null}
                        Get Verifier Detail
                      </button>
                    ) : (
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Verifier Info</span>
                        <p className="text-blue-900 font-bold text-lg">{verifierDetail.name || verifierDetail.verifierName || 'Unknown'}</p>
                        <p className="text-blue-700 font-medium text-sm">{verifierDetail.email || verifierDetail.verifierEmail || 'No email'}</p>
                      </div>
                    )}
                  </div>
                )}

                {isVerifier && user.obj?.verifiedByAdmin && (
                  <div className="flex gap-4 pt-4 mt-2 border-t border-slate-100">
                    <button
                      onClick={onRevokeVerification}
                      disabled={loading}
                      className="flex-1 premium-button bg-red-600 text-white hover:bg-red-700 py-4 shadow-xl shadow-red-600/20 flex items-center justify-center gap-2"
                    >
                      {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                      Revoke Verification
                    </button>
                    {user.obj?.hasRightToAdd && (
                      <button
                        onClick={onRevokeRights}
                        disabled={loading}
                        className="flex-1 premium-button bg-orange-500 text-white hover:bg-orange-600 py-4 shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2"
                      >
                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                        Revoke Rights
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
