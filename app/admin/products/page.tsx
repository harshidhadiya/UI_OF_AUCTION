'use client';
import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import AdminNavbar from '@/components/AdminNavbar';

export default function AdminProductsDashboard() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState<'pending' | 'mine' | 'all'>('pending');
  const [searchName, setSearchName] = useState('');
  const [searchTrigger, setSearchTrigger] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
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
      fetchProducts(page > 1);
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

  const fetchProducts = async (isLoadMore = false) => {
    setLoading(true);
    if (!isLoadMore) setIs404(false);

    const filterPayload = {
      name: searchName || undefined,
      pending: activeTab === 'pending',
      mine: activeTab === 'mine',
      verified: activeTab === 'all',
      page: page,
      pagesize: 10
    };

    try {
      const res = await api.post(`/api/verify/products`, filterPayload, false);
      if (res.success) {

        const dataArr = (res.data as any[]) || [];
        setHasMore(dataArr.length === 10);
        setProducts(prev => isLoadMore ? [...prev, ...dataArr] : dataArr);
      } else {
        if (res.statusCode === 404 || (res.data && (res.data as any[]).length === 0) || res.message?.includes("done fetching")) {
          if (!isLoadMore) {
            setIs404(true);
            setProducts([]);
          }
          setHasMore(false);
        } else {
          showNotification(res.message || "Failed to fetch products", 'error');
          if (!isLoadMore) setProducts([]);
        }
      }
    } catch (err) {
      console.error(err);
      showNotification("Network error. Please try again.", 'error');
      if (!isLoadMore) setProducts([]);
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
    if (page !== 1) setPage(1);
    setSearchTrigger(prev => !prev);
  };

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const openProductDetails = (product: any) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleVerifyAction = () => {
    setIsModalOpen(false);
    showNotification("Product verified successfully!", "success");
    handleSearch(); // triggers a refresh at page 1
  };

  return (
    <div className="min-h-screen bg-slate-50 page-enter">
      <AdminNavbar />

      <main className="max-w-7xl mx-auto p-8">
        <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-4xl font-extrabold text-slate-900 mb-2">
              {activeTab === 'pending' ? 'Pending Product Verifications' : activeTab === 'mine' ? 'My Verified Products' : 'All Verified Products'}
            </h2>
            <p className="text-slate-500">
              {activeTab === 'pending'
                ? 'Review and verify newly submitted items from sellers.'
                : activeTab === 'mine'
                  ? 'History of products you have personally verified.'
                  : 'Complete history of all verified products in the system.'}
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
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Product Name</label>
            <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)} placeholder="Search by name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-sm" />
          </div>
          <div className="flex gap-2 w-full md:w-auto mt-4 md:mt-0">
            <button onClick={handleClear} className="px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors text-sm w-full md:w-auto">
              Clear
            </button>
            <button onClick={handleSearch} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20 text-sm w-full md:w-auto">
              Search
            </button>
          </div>
        </div>

        {loading && products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl shadow-sm border border-slate-100">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400 font-medium tracking-wide">Syncing product catalogue...</p>
          </div>
        ) : activeTab === 'pending' && is404 ? (
          <div className="bg-red-500/5 border-2 border-red-500/20 rounded-[2.5rem] p-24 text-center shadow-inner-white overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform">
              <svg className="w-32 h-32 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            </div>
            <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-red-500/30">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h3 className="text-3xl font-black text-red-600 mb-3 tracking-tight uppercase">Queue Clear</h3>
            <p className="text-slate-600 font-bold text-lg max-w-sm mx-auto">Zero pending products discovered. Your inbox is clean!</p>
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {products.map((p: any, idx: number) => (
                <ProductVerificationCard key={p.id || p.productId || idx} product={p} onViewDetail={() => openProductDetails(p)} isHistory={activeTab !== 'pending'} />
              ))}
            </div>
            {hasMore ? (
              <div ref={observerTarget} className="flex justify-center py-12 mt-8">
                {loading && <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />}
              </div>
            ) : (
              <div className="text-center py-12 mt-8">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">End of records</p>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-[2.5rem] p-20 text-center shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Verification History</h3>
            <p className="text-slate-400">There are no verified products to display.</p>
          </div>
        )}

        {notification && (
          <div className={`fixed bottom-8 right-8 p-4 rounded-xl shadow-2xl z-50 animate-slide-up ${notification.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
            <p className="font-bold flex items-center gap-2">
              {notification.type === 'error' ? 'Oops!' : 'Success!'}
              <span className="font-normal">{notification.msg}</span>
            </p>
          </div>
        )}

        <ProductVerificationModal
          isOpen={isModalOpen}
          overviewProduct={selectedProduct}
          onClose={() => setIsModalOpen(false)}
          onVerify={handleVerifyAction}
          loading={isActionLoading}
        />
      </main>
    </div>
  );
}

function ProductVerificationCard({ product, onViewDetail, isHistory }: { product: any, onViewDetail: () => void, isHistory?: boolean }) {
  const isVerified = product.isVerified || product.IsVerified;

  // If unverified: show product description. If verified: show verifyDescription.
  const descriptionStr = isVerified
    ? (product.verifyDescription || product.VerifyDescription || 'No verification description added.')
    : (product.description || product.Description || 'No description provided.');

  return (
    <div className="premium-card bg-white p-6 relative overflow-hidden group hover:scale-[1.02] transition-transform border border-slate-100 flex flex-col h-full">
      {(isVerified) ? (
        <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-widest shadow-lg">
          VERIFIED
        </div>
      ) : (product.verifierId || product.VerifierId) ? (
        <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-widest shadow-lg">
          UNVERIFIED
        </div>
      ) : null}

      <div className="flex-1 space-y-4">
        <h4 className="font-black text-xl text-slate-900 leading-tight line-clamp-2">{product.productName || product.ProductName || 'Unknown Product'}</h4>

        <div className="text-xs text-slate-500">
          <ul className="space-y-1 line-clamp-3">
            {descriptionStr.split(',').map((point: string, idx: number) => (
              <li key={idx} className="flex gap-1.5">
                <span className="text-red-500 font-bold">•</span>
                <span className="truncate">{point.trim()}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button onClick={onViewDetail} className="premium-button w-full mt-6 bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-lg">
        Review Details
      </button>
    </div>
  );
}

function ProductVerificationModal({ isOpen, overviewProduct, onClose, onVerify, loading }: any) {
  const [fullProduct, setFullProduct] = useState<any>(null);
  const [verifierDetail, setVerifierDetail] = useState<any>(null);
  const [ownerDetail, setOwnerDetail] = useState<any>(null);
  const [fetching, setFetching] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  const [verifyDescPoints, setVerifyDescPoints] = useState<string[]>(['']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [unverifyDescPoints, setUnverifyDescPoints] = useState<string[]>(['']);
  const [isUnverifying, setIsUnverifying] = useState(false);

  const handleVerifyPointChange = (index: number, value: string) => {
    const newPoints = [...verifyDescPoints];
    newPoints[index] = value;
    setVerifyDescPoints(newPoints);
  };
  const addVerifyPoint = () => setVerifyDescPoints([...verifyDescPoints, '']);
  const removeVerifyPoint = (index: number) => {
    if (verifyDescPoints.length > 1) {
      setVerifyDescPoints(verifyDescPoints.filter((_, i) => i !== index));
    }
  };

  const handleUnverifyPointChange = (index: number, value: string) => {
    const newPoints = [...unverifyDescPoints];
    newPoints[index] = value;
    setUnverifyDescPoints(newPoints);
  };
  const addUnverifyPoint = () => setUnverifyDescPoints([...unverifyDescPoints, '']);
  const removeUnverifyPoint = (index: number) => {
    if (unverifyDescPoints.length > 1) {
      setUnverifyDescPoints(unverifyDescPoints.filter((_, i) => i !== index));
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setFullProduct(null);
      setVerifierDetail(null);
      setVerifyDescPoints(['']);
      setUnverifyDescPoints(['']);
    } else if (overviewProduct) {
      fetchFullDetails();
    }
  }, [isOpen, overviewProduct]);

  if (!isOpen || !overviewProduct) return null;

  const fetchFullDetails = async () => {
    setFetching(true);
    try {
      // 1. Fetch full product details using /api/Product/all 
      const payload = {
        productId: overviewProduct.id || overviewProduct.productId || overviewProduct.ProductId,
        page: 1,
        size: 1
      };
      const pRes = await api.post('/api/Product/all', payload, false);
      if (pRes.success && pRes.data && (pRes.data as any[]).length > 0) {
        const prod = (pRes.data as any[])[0];
        setFullProduct(prod);

        // 2. Fetch owner/submitter details using userId from product
        const userId = prod.user_id || prod.userId || prod.UserId;
        if (userId) {
          const uRes = await api.get(`/api/User/profile/${userId}`);
          if (uRes.success && uRes.data) {
            setOwnerDetail(uRes.data);
          }
        }
      }

      // 3. Fetch verifier details if verifierId exists
      const verifierId = overviewProduct.verifierId || overviewProduct.VerifierId;
      if (verifierId) {
        const vRes = await api.get(`/api/admin-request/details/${verifierId}`);
        if (vRes.success && vRes.data) {
          setVerifierDetail(vRes.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetching(false);
    }
  };

  const isVerified = overviewProduct.isVerified || overviewProduct.IsVerified;
  const authUser = auth.getUser();
  const currentUserId = authUser?.id || authUser?.userId;
  const hasVerifier = !!(overviewProduct.verifierId || overviewProduct.VerifierId);
  const isMyVerification = hasVerifier && (overviewProduct.verifierId === currentUserId || overviewProduct.VerifierId === currentUserId);
  const isVerifiedAdmin = authUser?.requestObj?.verifiedByAdmin === true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Product Review</h3>
            <p className="text-slate-500 text-sm mt-1">Cross-check the details before verifying.</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:shadow-md transition-all">
            ✕
          </button>
        </header>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
          {fetching ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-500 font-bold">Summoning intel...</p>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-8">
              {/* Product Images - Fetched from full details */}
              <div className="w-full md:w-1/2">
                {fullProduct?.images && fullProduct.images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {fullProduct.images.map((img: any, i: number) => (
                      <div key={i} onClick={() => setModalImage(img.imageUrl)} className={`group relative rounded-2xl overflow-hidden border-2 border-slate-100 cursor-pointer ${i === 0 ? 'col-span-2 h-64' : 'h-32'}`}>
                        <img src={img.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                          <svg className="w-8 h-8 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-slate-100 h-64 rounded-2xl flex items-center justify-center text-slate-400 font-bold border-2 border-slate-200 border-dashed">
                    No Images Provided
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div className="w-full md:w-1/2 space-y-6">
                <div>
                  <h4 className="text-3xl font-black text-slate-900 leading-tight mb-2">
                    {fullProduct?.name || overviewProduct.productName || overviewProduct.ProductName}
                  </h4>
                  <div className="flex items-center gap-2">
                    {fullProduct?.buyDate && (
                      <span className="px-3 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-md">
                        Buy Date: {new Date(fullProduct.buyDate).toLocaleDateString()}
                      </span>
                    )}
                    {isVerified && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-widest rounded-md">
                        Verified
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">
                      Product Description
                    </span>
                    <ul className="space-y-2">
                      {((fullProduct?.description || overviewProduct.description || overviewProduct.Description) || 'No description').split(',').map((point: string, idx: number) => (
                        <li key={idx} className="flex gap-2 text-slate-700 text-sm">
                          <span className="text-slate-400 font-bold">•</span>
                          {point.trim()}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {isVerified && (
                    <div className="pt-4 border-t border-slate-200">
                      <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest block mb-3">
                        Admin Verify Remarks
                      </span>
                      <ul className="space-y-2">
                        {((fullProduct?.verifyDescription || overviewProduct.verifyDescription || overviewProduct.VerifyDescription) || 'No remarks').split(',').map((point: string, idx: number) => (
                          <li key={idx} className="flex gap-2 text-emerald-700 text-sm">
                            <span className="text-emerald-500 font-bold">•</span>
                            {point.trim()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Owner/Submitter Details */}
                {ownerDetail && (
                  <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100/50">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block mb-3">Submitted By (Owner)</span>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold overflow-hidden shadow-sm">
                        {ownerDetail.imageUrl ? (
                          <img src={ownerDetail.imageUrl} className="w-full h-full object-cover" />
                        ) : (
                          (ownerDetail.name || ownerDetail.Name || '?').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-slate-900 font-bold text-sm">{ownerDetail.name || ownerDetail.Name || 'N/A'}</p>
                        <p className="text-amber-700 text-xs font-semibold">{ownerDetail.email || ownerDetail.Email || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 pt-3 border-t border-amber-100">
                      <div className="flex justify-between items-center bg-white/60 p-2 rounded-lg">
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Phone</span>
                        <span className="text-xs font-bold text-slate-700">{ownerDetail.phone || ownerDetail.Phone || ownerDetail.mobile || ownerDetail.Mobile || 'N/A'}</span>
                      </div>
                      <div className="flex flex-col bg-white/60 p-2 rounded-lg">
                        <span className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-0.5">Address</span>
                        <span className="text-xs font-bold text-slate-700">{ownerDetail.address || ownerDetail.Address || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Verifier Detail Block */}
                {verifierDetail && (
                  <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/50">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-2">
                      {isVerified ? 'Verified By Admin' : 'Previously Unverified By Admin'}
                    </span>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 font-bold overflow-hidden shadow-sm">
                        {verifierDetail.imageUrl ? (
                          <img src={verifierDetail.imageUrl} className="w-full h-full object-cover" />
                        ) : (
                          (verifierDetail.name || verifierDetail.verifierName || '?').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-blue-900 font-bold text-sm">{verifierDetail.name || verifierDetail.verifierName}</p>
                        <p className="text-blue-600 text-xs font-semibold">{verifierDetail.email || verifierDetail.verifierEmail}</p>
                      </div>
                    </div>
                  </div>
                )}

                {!isVerifiedAdmin ? (
                  <div className="bg-red-50 text-red-700 p-4 rounded-xl font-bold text-center border border-red-100 text-sm mt-4">
                    You do not have the verified admin rights to review products.
                  </div>
                ) : !isVerified ? (
                  (!hasVerifier || isMyVerification) ? (
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Admin Remarks (Point-wise)</label>
                        <div className="space-y-2 mb-4">
                          {verifyDescPoints.map((point, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input
                                type="text"
                                value={point}
                                onChange={e => handleVerifyPointChange(idx, e.target.value)}
                                placeholder={`Remark ${idx + 1}`}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-sm"
                              />
                              <button
                                onClick={() => removeVerifyPoint(idx)}
                                disabled={verifyDescPoints.length === 1}
                                className="px-4 bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl font-bold transition-all disabled:opacity-50"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={addVerifyPoint}
                            className="text-sm font-bold text-red-500 hover:text-red-700 flex items-center gap-1 mt-2"
                          >
                            + Add Point
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          setIsVerifying(true);
                          try {
                            const payload = {
                              ProductId: overviewProduct.id || overviewProduct.productId || overviewProduct.ProductId,
                              SellerId: overviewProduct.sellerId || overviewProduct.SellerId || fullProduct?.userId,
                              description: verifyDescPoints.map(p => p.trim()).filter(Boolean).join(',')
                            };

                            const res = await api.post('/api/verify/product', payload, false);
                            if (res.success) {
                              onClose();
                              if (onVerify) onVerify();
                            } else {
                              alert(res.message || 'Verification failed');
                            }
                          } catch (e) {
                            alert('Network error');
                          } finally {
                            setIsVerifying(false);
                          }
                        }}
                        disabled={isVerifying || verifyDescPoints.every(p => !p.trim())}
                        className="w-full premium-button bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed py-4 shadow-xl shadow-red-500/20 flex items-center justify-center gap-2"
                      >
                        {isVerifying ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                        Approve & Verify Product
                      </button>
                      <p className="text-center text-xs text-slate-400 mt-3 font-medium">This exposes the product to the global marketplace.</p>
                    </div>
                  ) : (
                    <div className="bg-slate-50 text-slate-700 p-4 rounded-xl font-bold text-center border border-slate-200 text-sm mt-4">
                      This product was actively reviewed by another admin. Action locked.
                    </div>
                  )
                ) : (
                  isMyVerification ? (
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Unverify Remarks (Point-wise)</label>
                        <div className="space-y-2 mb-4">
                          {unverifyDescPoints.map((point, idx) => (
                            <div key={idx} className="flex gap-2">
                              <input
                                type="text"
                                value={point}
                                onChange={e => handleUnverifyPointChange(idx, e.target.value)}
                                placeholder={`Reason ${idx + 1}`}
                                className="w-full px-4 py-3 bg-red-50 border border-red-200 text-red-900 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-sm"
                              />
                              <button
                                onClick={() => removeUnverifyPoint(idx)}
                                disabled={unverifyDescPoints.length === 1}
                                className="px-4 bg-red-100 text-red-400 hover:text-red-700 hover:bg-red-200 rounded-xl font-bold transition-all disabled:opacity-50"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={addUnverifyPoint}
                            className="text-sm font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1 mt-2"
                          >
                            + Add Point
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          setIsUnverifying(true);
                          try {
                            const payload = {
                              ProductId: overviewProduct.id || overviewProduct.productId || overviewProduct.ProductId,
                              description: unverifyDescPoints.map(p => p.trim()).filter(Boolean).join(',')
                            };
                            const res = await api.patch('/api/verify/product', payload, false);
                            if (res.success) {
                              onClose();
                              if (onVerify) onVerify();
                            } else {
                              alert(res.message || 'Unverification failed');
                            }
                          } catch (e) {
                            alert('Network error');
                          } finally {
                            setIsUnverifying(false);
                          }
                        }}
                        disabled={isUnverifying || unverifyDescPoints.every(p => !p.trim())}
                        className="w-full premium-button bg-slate-800 text-white hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed py-4 shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2"
                      >
                        {isUnverifying ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                        Unverify Product
                      </button>
                    </div>
                  ) : (
                    <div className="bg-green-50 text-green-700 p-4 rounded-xl font-bold text-center border border-green-100 text-sm mt-4">
                      This product is actively verified by another admin.
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {modalImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/95 backdrop-blur-sm p-4 animate-in fade-in" onClick={() => setModalImage(null)}>
          <button onClick={() => setModalImage(null)} className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img src={modalImage} className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
