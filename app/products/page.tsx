'use client';
import { useState, useEffect, useRef } from 'react';
import { api, ApiResponse } from '@/lib/api';
import { auth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('mine');
  const observerTarget = useRef<HTMLDivElement>(null);

  // Search Filters
  const [searchName, setSearchName] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState(false);
  const [buyFrom, setBuyFrom] = useState('');
  const [buyTo, setBuyTo] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [searchTrigger, setSearchTrigger] = useState(false);

  // Create Product Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [productToUpdate, setProductToUpdate] = useState<any>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [isAuctionModalOpen, setIsAuctionModalOpen] = useState(false);
  const [isUpdateAuctionModalOpen, setIsUpdateAuctionModalOpen] = useState(false);
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
      fetchProducts(page > 1);
    };
    init();
  }, [page, activeTab, searchTrigger, verifiedFilter]);

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

  const fetchProducts = async (isLoadMore = false) => {
    setLoading(true);
    if (!isLoadMore) setIs404(false);

    const payload = {
      mine: activeTab === 'mine',
      verified: verifiedFilter,
      searchName: searchName || undefined,
      buyFrom: buyFrom ? new Date(buyFrom).toLocaleString('sv-SE').replace(' ', 'T') : undefined,
      buyTo: buyTo ? new Date(buyTo).toLocaleString('sv-SE').replace(' ', 'T') : undefined,
      createdFrom: activeTab === 'mine' && createdFrom ? new Date(createdFrom).toLocaleString('sv-SE').replace(' ', 'T') : undefined,
      createdTo: activeTab === 'mine' && createdTo ? new Date(createdTo).toLocaleString('sv-SE').replace(' ', 'T') : undefined,
      page: page,
      size: 10
    };

    try {
      const res = await api.post('/api/Product/all', payload, false);
      if (res.success && res.data) {
        const newData = res.data as any[];
        setHasMore(newData.length === 10);
        setProducts(prev => isLoadMore ? [...prev, ...newData] : newData);
      } else {
        if (res.statusCode === 404 || res.message?.includes("0 product") || res.message?.includes("done fetching")) {
          if (!isLoadMore) {
            setIs404(true);
            setProducts([]);
          }
          setHasMore(false);
        } else {
          console.log("entered")
          showNotification(res.message || "Failed to fetch products", 'error');
          if (!isLoadMore) setProducts([]);
        }
      }
    } catch (err) {
      console.error(err);
      if (!isLoadMore) {
        setIs404(true);
        setProducts([]);
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
    setSearchName('');
    setVerifiedFilter(false);
    setBuyFrom('');
    setBuyTo('');
    setCreatedFrom('');
    setCreatedTo('');
    if (page !== 1) setPage(1);
    setSearchTrigger(prev => !prev);
  };

  const showNotification = (msg: string, type: 'success' | 'error') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] page-enter relative overflow-hidden">
      <div className="yellow-blob" />
      <Navbar />

      <main className="relative z-10 max-w-7xl mx-auto px-6 md:px-8 pt-24 pb-16">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 bg-[#FFD000] rounded-full" />
              <span className="text-[10px] font-black text-[#6B6557] uppercase tracking-widest">My Catalogue</span>
            </div>
            <h2 className="display-heading text-[#111]" style={{ fontSize: 'clamp(2.4rem,4.5vw,4.5rem)' }}>PRODUCT HUB.</h2>
            <p className="text-[#6B6557] font-medium mt-2">Discover and manage your premium auction items.</p>
          </div>

          <div className="flex gap-4 flex-col sm:flex-row">
            {(currentUser?.role === 'SELLER' || currentUser?.role === 'USER') && (
              <button onClick={() => setIsModalOpen(true)} className="cta-button px-8 text-sm h-12">
                + Add Product
              </button>
            )}
          </div>
        </header>

        {/* Filters */}
        <div className="bg-white border border-[#E5DFD3] rounded-2xl p-5 mb-8 shadow-[0_2px_12px_rgba(0,0,0,0.05)]">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-1.5">Name</label>
              <input type="text" value={searchName} onChange={e => setSearchName(e.target.value)} placeholder="Search product name" className="w-full px-4 py-3 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl focus:border-[#FFD000] focus:ring-4 focus:ring-[#FFD000]/10 outline-none transition-all text-sm text-[#111] font-medium" />
            </div>

            <div className="flex flex-col justify-end shrink-0">
              <span className="block text-[10px] text-transparent mb-1.5" aria-hidden="true">&nbsp;</span>
              <div className="flex items-center gap-2.5 h-[48px] px-1">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={verifiedFilter} onChange={e => { setVerifiedFilter(e.target.checked); setPage(1); }} />
                  <div className="w-10 h-5 bg-[#E5DFD3] rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FFD000]"></div>
                </label>
                <span className="text-[10px] font-black text-[#6B6557] uppercase tracking-widest whitespace-nowrap">Verified Only</span>
              </div>
            </div>

            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-1.5">Buy Date From</label>
              <input type="date" value={buyFrom} onChange={e => setBuyFrom(e.target.value)} className="w-full px-4 py-3 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl focus:border-[#FFD000] outline-none text-sm text-[#111] font-medium" />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-1.5">Buy Date To</label>
              <input type="date" value={buyTo} onChange={e => setBuyTo(e.target.value)} className="w-full px-4 py-3 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl focus:border-[#FFD000] outline-none text-sm text-[#111] font-medium" />
            </div>

            {activeTab === 'mine' && (
              <>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-1.5">Created From</label>
                  <input type="date" value={createdFrom} onChange={e => setCreatedFrom(e.target.value)} className="w-full px-4 py-3 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl focus:border-[#FFD000] outline-none text-sm text-[#111] font-medium" />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-1.5">Created To</label>
                  <input type="date" value={createdTo} onChange={e => setCreatedTo(e.target.value)} className="w-full px-4 py-3 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl focus:border-[#FFD000] outline-none text-sm text-[#111] font-medium" />
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button onClick={handleClear} className="px-5 py-3 bg-[#FAF7F0] border-2 border-[#E5DFD3] text-[#6B6557] font-black text-xs uppercase tracking-widest rounded-xl hover:border-[#111] hover:text-[#111] transition-all">Clear</button>
              <button onClick={handleSearch} className="cta-button px-6 py-3 h-auto text-xs">Search</button>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {loading && products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-[#E5DFD3]">
            <div className="w-12 h-12 border-4 border-[#E5DFD3] border-t-[#FFD000] rounded-full animate-spin mb-4" />
            <p className="text-[#B8B0A0] font-black text-[10px] uppercase tracking-widest">Fetching Products...</p>
          </div>
        ) : is404 || products.length === 0 ? (
          <div className="bg-white rounded-3xl p-20 text-center border border-[#E5DFD3]">
            <div className="text-6xl mb-6">📦</div>
            <h3 className="text-2xl font-black text-[#111] mb-3">No Products Found</h3>
            <p className="text-[#6B6557] font-medium max-w-sm mx-auto">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((p: any) => (
                <ProductCard key={p.id || p.Id} product={p} currentUser={currentUser} onViewDetail={() => setSelectedProduct(p)} />
              ))}
            </div>

            {hasMore ? (
              <div ref={observerTarget} className="flex justify-center py-12 mt-8">
                {loading && <div className="w-8 h-8 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />}
              </div>
            ) : (
              <div className="text-center py-12 mt-8">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">End of catalogue</p>
              </div>
            )}
          </>
        )}

        <CreateProductModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => { setIsModalOpen(false); handleSearch(); showNotification("Product created!", "success"); }}
          onError={(msg: string) => showNotification(msg, "error")}
        />

        <ProductDetailsModal
          isOpen={!!selectedProduct}
          product={selectedProduct}
          currentUser={currentUser}
          onClose={() => setSelectedProduct(null)}
          onEdit={() => {
            setProductToUpdate(selectedProduct);
            setSelectedProduct(null);
            setIsUpdateModalOpen(true);
          }}
          onDeleteSuccess={(msg: string) => {
            setSelectedProduct(null);
            showNotification(msg, 'success');
            handleSearch();
          }}
          onOpenAuctionCreate={() => {
            setAuctionProduct(selectedProduct);
            setSelectedProduct(null);
            setIsAuctionModalOpen(true);
          }}
          onOpenAuctionUpdate={() => {
            setAuctionProduct(selectedProduct);
            setSelectedProduct(null);
            setIsUpdateAuctionModalOpen(true);
          }}
        />

        <CreateAuctionModal
          isOpen={isAuctionModalOpen}
          product={auctionProduct}
          onClose={() => setIsAuctionModalOpen(false)}
          onSuccess={() => { setIsAuctionModalOpen(false); handleSearch(); showNotification("Auction created successfully!", "success"); }}
          onError={(msg: string) => showNotification(msg, "error")}
        />

        <UpdateAuctionModal
          isOpen={isUpdateAuctionModalOpen}
          product={auctionProduct}
          onClose={() => setIsUpdateAuctionModalOpen(false)}
          onSuccess={() => { setIsUpdateAuctionModalOpen(false); handleSearch(); showNotification("Auction updated successfully!", "success"); }}
          onError={(msg: string) => showNotification(msg, "error")}
        />

        <UpdateProductModal
          isOpen={isUpdateModalOpen}
          product={productToUpdate}
          onClose={() => setIsUpdateModalOpen(false)}
          onSuccess={(msg: string) => {
            setIsUpdateModalOpen(false);
            setProductToUpdate(null);
            showNotification(msg, 'success');
            handleSearch();
          }}
          onError={(msg: string) => showNotification(msg, "error")}
        />

        {notification && (
          <div className={`fixed bottom-8 right-8 px-5 py-4 rounded-2xl shadow-2xl z-50 animate-slide-left flex items-center gap-3 max-w-sm text-sm font-bold border ${
            notification.type === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-[#FAF7F0] text-[#111] border-[#FFD000]'
          }`}>
            <span>{notification.type === 'error' ? '❌' : '✅'}</span>
            <span>{notification.msg}</span>
          </div>
        )}
      </main>
    </div>
  );
}

function ProductCard({ product, currentUser, onViewDetail }: { product: any, currentUser: any, onViewDetail: () => void }) {
  const isMine = (product.user_id || product.userId) === currentUser?.id;
  const isVerified = product.verified || product.Verified;
  const mainImage = product.images && product.images.length > 0 ? product.images[0].imageUrl : 'https://via.placeholder.com/300?text=No+Image';

  return (
    <div onClick={onViewDetail} className="bg-white rounded-2xl overflow-hidden border border-[#E5DFD3] flex flex-col h-full group cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
      <div className="relative h-48 bg-slate-100 overflow-hidden">
        <img src={mainImage} alt={product.name || product.Name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {isVerified && (
            <span className="px-3 py-1 bg-green-500/90 text-white text-[10px] font-bold rounded-full uppercase tracking-widest shadow-sm backdrop-blur-sm">Verified</span>
          )}
          {isMine && (
            <span className="px-3 py-1 bg-slate-900/90 text-white text-[10px] font-bold rounded-full uppercase tracking-widest shadow-sm backdrop-blur-sm">My Product</span>
          )}
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-lg font-black text-[#111] mb-2 truncate group-hover:text-[#B8960C] transition-colors">{product.name || product.Name}</h3>
        <ul className="text-[#6B6557] text-sm mb-4 flex-1 space-y-1">
          {((product.description || product.Description) || '').split(',').filter((p: string) => p.trim()).map((point: string, idx: number) => (
            <li key={idx} className="flex gap-1.5 items-start">
              <span className="text-[#FFD000] font-bold mt-0.5">•</span>
              <span className="line-clamp-1">{point.trim().replace(/^[-*]\s*/, '')}</span>
            </li>
          ))}
        </ul>

        {(product.auctionStartTime || product.auctionEndTime) && (
          <div className="bg-brand-accent/5 border border-brand-accent/20 rounded-xl p-3 mb-4 space-y-1">
            <h4 className="text-[10px] uppercase font-black tracking-widest text-brand-accent mb-1">
              Auction Schedule - {new Date(product.auctionStartTime || product.auctionEndTime).toLocaleDateString()}
            </h4>
            {product.auctionStartTime && (
              <p className="text-xs font-semibold text-slate-600 flex justify-between">
                <span>Starts:</span>
                <span className="font-bold text-slate-900">
                  {new Date(product.auctionStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </p>
            )}
            {product.auctionEndTime && (
              <p className="text-xs font-semibold text-slate-600 flex justify-between">
                <span>Ends:</span>
                <span className="font-bold text-slate-900">
                  {new Date(product.auctionEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </p>
            )}
          </div>
        )}

        <div className="border-t border-slate-100 pt-4 mt-auto">
          <p className="text-xs text-slate-400 font-semibold mb-1 uppercase tracking-wider">Buy Date</p>
          <p className="text-slate-800 font-bold">{new Date(product.product_buy_date || product.Product_buy_date).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

function ProductDetailsModal({ isOpen, product, currentUser, onClose, onDeleteSuccess, onEdit, onOpenAuctionCreate, onOpenAuctionUpdate }: any) {
  const router = useRouter();
  const [ownerDetail, setOwnerDetail] = useState<any>(null);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  const [existingAuction, setExistingAuction] = useState<any>(null);
  const [loadingAuction, setLoadingAuction] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      checkExistingAuction();
    } else {
      setExistingAuction(null);
      setOwnerDetail(null);
    }
  }, [isOpen, product]);

  const checkExistingAuction = async () => {
    setLoadingAuction(true);
    try {
      // Use more targeted query as per user request
      const res = await api.get(`/api/auctions?productId=${product.id || product.Id}`);
      if (res.success && res.data && (res.data as any).items) {
        // Auction list is in res.data.items
        const myAuction = (res.data as any).items[0];
        setExistingAuction(myAuction || null);
        console.log(myAuction)
      }
    } catch (e) {
      console.error("Error checking existing auction", e);
    } finally {
      setLoadingAuction(false);
    }
  };

  if (!isOpen || !product) return null;

  const isMine = (product.user_id || product.userId) === currentUser?.id;
  const isVerified = product.verified || product.Verified;

  const fetchOwnerDetail = async () => {
    setLoadingOwner(true);
    try {
      const res = await api.get(`/api/User/profile?id=${product.user_id || product.userId}`);
      if (res.success && res.data) {
        setOwnerDetail(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingOwner(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    setIsDeleting(true);
    try {
      const res = await api.delete(`/api/Product/${product.id || product.Id}`);
      if (res.success) {
        onDeleteSuccess?.(res.message || 'Product deleted successfully');
      } else {
        alert(res.message || 'Failed to delete product');
      }
    } catch (e) {
      alert('An error occurred while deleting the product');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pt-28 pb-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl my-8 overflow-hidden animate-in fade-in zoom-in duration-300 relative flex flex-col md:flex-row min-h-[500px]">

        {/* Images Column */}
        <div className="w-full md:w-1/2 bg-slate-50 border-r border-slate-100 p-6 flex flex-col">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Product Images ({product.images?.length || 0}/5)</h3>
          {product.images && product.images.length > 0 ? (
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[60vh] pr-2 custom-scrollbar">
              {product.images.map((img: any) => (
                <div key={img.id} onClick={() => setModalImage(img.imageUrl)} className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm group cursor-pointer">
                  <img src={img.imageUrl} alt="Product Image" className="w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity duration-300">
                    <svg className="w-10 h-10 text-white drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-bold">No images available</p>
            </div>
          )}
        </div>

        {/* Details Column */}
        <div className="w-full md:w-1/2 p-8 flex flex-col relative">
          <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all z-10">
            ✕
          </button>

          <div className="flex flex-wrap gap-2 mb-6 pr-12">
            {isVerified && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full uppercase tracking-widest">Verified Target</span>
            )}
            {isMine && (
              <span className="px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded-full uppercase tracking-widest">Your Listed Product</span>
            )}
          </div>

          <h2 className="text-3xl font-black text-slate-900 mb-6 leading-tight">{product.name || product.Name}</h2>

          <div className="space-y-6 flex-1">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2">Description</h4>
              <ul className="text-slate-600 leading-relaxed space-y-2 list-disc pl-5">
                {(product.description || product.Description || '').split(',').map((line: string, i: number) => line.trim() ? (
                  <li key={i}>{line.trim().replace(/^[-*]\s*/, '')}</li>
                ) : null)}
              </ul>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 inline-block w-fit pr-12">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block mb-1">Buy Date</span>
                <p className="text-blue-900 font-bold">{new Date(product.product_buy_date || product.Product_buy_date).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="pt-4 mt-auto">
              {!isMine && !ownerDetail && (
                <button onClick={fetchOwnerDetail} disabled={loadingOwner} className="w-full premium-button bg-brand-accent text-white shadow-xl shadow-brand-accent/20 py-4 font-bold text-sm tracking-wide flex items-center justify-center gap-2">
                  {loadingOwner && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Get Owner Detail
                </button>
              )}

              {!isMine && ownerDetail && (
                <div className="bg-brand-accent/5 p-4 rounded-xl border border-brand-accent/20 w-full space-y-3">
                  <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest block mb-1">Owner Info</span>
                  <div>
                    <p className="text-slate-900 font-bold text-lg">{ownerDetail.name || ownerDetail.Name || 'Unknown'}</p>
                    <p className="text-slate-700 font-medium text-sm">{ownerDetail.email || ownerDetail.Email}</p>
                  </div>
                  <div className="pt-3 border-t border-brand-accent/10 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest block">Phone</span>
                      <p className="text-slate-700 font-medium text-sm">{ownerDetail.phone || ownerDetail.Phone || ownerDetail.mobile || ownerDetail.Mobile || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-brand-accent uppercase tracking-widest block">Address</span>
                      <p className="text-slate-700 font-medium text-sm">{ownerDetail.address || ownerDetail.Address || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              )}

              {isMine && (
                <div className="flex flex-col gap-3">
                  {isVerified && (
                    (loadingAuction) ? (
                      <div className="w-full py-4 flex items-center justify-center gap-2 text-slate-400 font-bold text-sm bg-slate-50 rounded-xl border border-slate-100 italic">
                        <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin" />
                        Checking status...
                      </div>
                    ) : (existingAuction || product.auctionStartTime || product.AuctionStartTime) ? (
                      <button
                        onClick={() => router.push(`/auctions?search=${encodeURIComponent(product.name || product.Name)}`)}
                        className="w-full premium-button bg-slate-50 text-slate-700 border border-slate-200 py-4 font-bold text-sm tracking-wide hover:bg-slate-100 transition-all flex items-center justify-center gap-3 group shadow-sm"
                        title="Click to view details in Auction Hub"
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] uppercase tracking-widest text-slate-400 group-hover:text-brand-accent transition-colors">Auction Scheduled</span>
                          <span className="text-slate-800 font-black">
                            {new Date(existingAuction?.startDate || existingAuction?.StartDate || product.auctionStartTime || product.AuctionStartTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <svg className="w-5 h-5 text-brand-accent group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </button>
                    ) : (
                      <button onClick={onOpenAuctionCreate} className="w-full premium-button bg-brand-accent text-white shadow-xl shadow-brand-accent/20 py-4 font-bold text-sm tracking-wide hover:bg-brand-accent/90 transition-all flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Launch Auction
                      </button>
                    )
                  )}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={onEdit} className="flex-1 premium-button bg-blue-500 text-white shadow-xl shadow-blue-500/20 py-4 font-bold text-sm tracking-wide hover:bg-blue-600 transition-colors flex items-center justify-center">
                      Edit Product
                    </button>
                    <button onClick={handleDelete} disabled={isDeleting} className="flex-1 premium-button bg-red-500 text-white shadow-xl shadow-red-500/20 py-4 font-bold text-sm tracking-wide hover:bg-red-600 transition-colors flex items-center justify-center gap-2">
                      {isDeleting && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                    <button onClick={onClose} className="flex-1 premium-button bg-slate-900 text-white shadow-xl shadow-slate-900/20 py-4 font-bold text-sm tracking-wide hover:bg-black transition-colors">
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
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

function CreateProductModal({ isOpen, onClose, onSuccess, onError }: any) {
  const [name, setName] = useState('');
  const [descPoints, setDescPoints] = useState<string[]>(['']);
  const [buyDate, setBuyDate] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handlePointChange = (index: number, value: string) => {
    const newPoints = [...descPoints];
    newPoints[index] = value;
    setDescPoints(newPoints);
  };

  const addPoint = () => setDescPoints([...descPoints, '']);

  const removePoint = (index: number) => {
    if (descPoints.length > 1) {
      setDescPoints(descPoints.filter((_, i) => i !== index));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      if (filesArr.length + images.length > 5) {
        onError("You can only upload a maximum of 5 images.");
        return;
      }
      setImages(prev => [...prev, ...filesArr].slice(0, 5));
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || descPoints.every(p => !p.trim()) || !buyDate) return onError("Please fill in all details.");

    // Validate past date
    const selectedDate = new Date(buyDate);
    if (selectedDate > new Date()) {
      return onError("Buy Date must be in the past!");
    }

    setLoading(true);
    const formData = new FormData();
    const formattedDesc = descPoints.map(p => p.trim()).filter(Boolean).join(',');
    formData.append('name', name);
    formData.append('description', formattedDesc);
    // Use ISOString as typical for C# DateTime mapping
    formData.append('date', selectedDate.toLocaleString('sv-SE').replace(' ', 'T'));

    images.forEach(file => {
      formData.append('images', file);
    });

    try {
      const res = await api.post('/api/Product', formData, true);
      if (res.success) {
        // Clear form
        setName(''); setDescPoints(['']); setBuyDate(''); setImages([]);
        onSuccess();
      } else {
        onError(res.message || "Failed to create product");
      }
    } catch (err) {
      onError("Error communicating with server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pt-28 pb-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl my-8 overflow-hidden animate-in fade-in zoom-in duration-300 relative">
        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Add Product</h3>
            <p className="text-slate-500 text-sm mt-1">List your premium item directly into the catalogue.</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:shadow-md transition-all">
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Product Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all" placeholder="E.g., Vintage Rolex Submariner" />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Description Points</label>
              <div className="space-y-3">
                {descPoints.map((point, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <span className="text-slate-400 font-bold text-xs w-4">{idx + 1}.</span>
                    <input type="text" value={point} onChange={e => handlePointChange(idx, e.target.value)} required={idx === 0} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all text-sm" placeholder="E.g., Mint condition, minimal wear..." />
                    {descPoints.length > 1 && (
                      <button type="button" onClick={() => removePoint(idx)} className="w-10 h-10 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center font-bold text-lg leading-none shrink-0" title="Remove point">
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addPoint} className="mt-4 text-sm font-bold text-brand-accent hover:text-brand-accent/80 flex items-center gap-1 bg-brand-accent/5 px-4 py-2 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add another point
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-bold text-slate-700">Buy Date</label>
                <div className="group relative flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-500 text-[10px] font-bold cursor-help border border-blue-100">
                  i
                  <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-xs rounded-lg shadow-xl -left-20">
                    You must enter the buy date which should be in the past.
                  </div>
                </div>
              </div>
              <input type="date" value={buyDate} max={new Date().toLocaleString('sv-SE').replace(' ', 'T').split('T')[0]} onChange={e => setBuyDate(e.target.value)} required className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all text-slate-700" />
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-bold text-slate-700">Images</label>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">{images.length} / 5</span>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="w-12 h-12 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-brand-accent">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </div>
                <p className="text-sm font-bold text-slate-600">Click to upload images</p>
                <p className="text-xs text-slate-400 mt-1">PNG, JPG up to 5 files</p>
                <input type="file" ref={fileInputRef} onChange={handleImageChange} className="hidden" multiple accept="image/*" />
              </div>

              {images.length > 0 && (
                <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shrink-0 group">
                      <img src={URL.createObjectURL(img)} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeImage(idx)} className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 px-6 py-4 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-[2] premium-button bg-brand-accent text-white shadow-xl shadow-brand-accent/20 py-4 flex items-center justify-center gap-2">
              {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Processing...' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UpdateProductModal({ isOpen, product, onClose, onSuccess, onError }: any) {
  const [name, setName] = useState('');
  const [descPoints, setDescPoints] = useState<string[]>(['']);
  const [buyDate, setBuyDate] = useState('');
  const [replacedImages, setReplacedImages] = useState<{ id: number, file: File, preview: string }[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      setName(product.name || product.Name || '');
      const d = product.description || product.Description || '';
      const parsedPoints = d.split(',').map((p: string) => p.trim()).filter(Boolean);
      setDescPoints(parsedPoints.length ? parsedPoints : ['']);
      const bd = product.product_buy_date || product.Product_buy_date;
      if (bd) {
        setBuyDate(new Date(bd).toLocaleString('sv-SE').replace(' ', 'T').split('T')[0]);
      }
      setReplacedImages([]);
      setNewImages([]);
      setDeletedImageIds([]);
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const handlePointChange = (index: number, value: string) => {
    const newPoints = [...descPoints];
    newPoints[index] = value;
    setDescPoints(newPoints);
  };
  const addPoint = () => setDescPoints([...descPoints, '']);
  const removePoint = (index: number) => {
    if (descPoints.length > 1) {
      setDescPoints(descPoints.filter((_, i) => i !== index));
    }
  };

  const handleImageReplace = (id: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const preview = URL.createObjectURL(file);
      setReplacedImages(prev => {
        const existing = prev.filter(p => p.id !== id);
        return [...existing, { id, file, preview }];
      });
    }
  };


  const handleRemoveReplacement = (id: number) => {
    setReplacedImages(prev => prev.filter(p => p.id !== id));
  };

  const getReplacement = (id: number) => replacedImages.find(r => r.id === id);

  const handleAddNewImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      const existingCount = product.images?.length || 0;
      const maxNew = 5 - existingCount;
      if (filesArr.length + newImages.length > maxNew) {
        return onError(`You can only add ${maxNew} more image(s).`);
      }
      setNewImages(prev => [...prev, ...filesArr].slice(0, maxNew));
    }
  };

  const removeNewImage = (index: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeleteImage = async (imageId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm("Are you sure you want to permanently delete this image?")) return;

    try {
      setLoading(true);

      const res = await api.delete(`/api/Product/${product.id}/images/${imageId}`);
      if (res.success) {
        setDeletedImageIds(prev => [...prev, imageId]);
        handleRemoveReplacement(imageId); // Cancel any replacements if it gets deleted
      } else {
        onError(res.message || "Failed to delete image.");
      }
    } catch (err) {
      onError("Error communicating with server.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || descPoints.every(p => !p.trim()) || !buyDate) return onError("Please fill in all details.");

    setLoading(true);
    const formData = new FormData();
    const formattedDesc = descPoints.map(p => p.trim()).filter(Boolean).join(',');
    formData.append('name', name);
    formData.append('description', formattedDesc);
    formData.append('date', new Date(buyDate).toLocaleString('sv-SE').replace(' ', 'T'));

    replacedImages.forEach(ri => {
      formData.append('ids', ri.id.toString());
      formData.append('images', ri.file);
    });

    try {
      const res = await api.patch(`/api/Product/${product.id}`, formData, true);
      let imagesRes: any = { success: true, message: '' };

      if (res.success && newImages.length > 0) {
        const imageFormData = new FormData();
        imageFormData.append('id', product.id.toString());
        newImages.forEach(img => imageFormData.append('images', img));
        imagesRes = await api.post('/api/Product/images', imageFormData, true);
      }

      if (res.success && imagesRes.success) {
        onSuccess('Product updated successfully!');
      } else {
        onError("Some updates failed or partially completed.");
      }
    } catch (err) {
      onError("Error communicating with server.");
    } finally {
      setLoading(false);
    }
  };

  const existingImages = (product.images || []).filter((img: any) => !deletedImageIds.includes(img.id));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pt-28 pb-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl my-8 overflow-hidden animate-in fade-in zoom-in duration-300 relative">
        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Edit Product</h3>
            <p className="text-slate-500 text-sm mt-1">Update your premium item details.</p>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:shadow-md transition-all">
            ✕
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Product Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all" placeholder="E.g., Vintage Rolex Submariner" />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Description Points</label>
              <div className="space-y-3">
                {descPoints.map((point, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <span className="text-slate-400 font-bold text-xs w-4">{idx + 1}.</span>
                    <input type="text" value={point} onChange={e => handlePointChange(idx, e.target.value)} required={idx === 0} className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all text-sm" placeholder="E.g., Mint condition, minimal wear..." />
                    {descPoints.length > 1 && (
                      <button type="button" onClick={() => removePoint(idx)} className="w-10 h-10 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center font-bold text-lg leading-none shrink-0" title="Remove point">
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addPoint} className="mt-4 text-sm font-bold text-brand-accent hover:text-brand-accent/80 flex items-center gap-1 bg-brand-accent/5 px-4 py-2 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add another point
              </button>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="block text-sm font-bold text-slate-700">Buy Date</label>
              </div>
              <input type="date" value={buyDate} max={new Date().toLocaleString('sv-SE').replace(' ', 'T').split('T')[0]} onChange={e => setBuyDate(e.target.value)} required className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all text-slate-700" />
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-bold text-slate-700">Images</label>
                <span className="text-xs font-medium text-slate-500">
                  {existingImages.length + newImages.length} / 5
                  {existingImages.length > 0 && " (Click an existing image to replace it)"}
                </span>
              </div>
              <div className="flex gap-3 mt-2 overflow-x-auto pb-2 custom-scrollbar">
                {existingImages.map((img: any) => {
                  const repl = getReplacement(img.id);
                  return (
                    <div key={img.id} className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-slate-200 shrink-0 group hover:border-brand-accent transition-colors flex items-center justify-center">
                      <img src={repl ? repl.preview : img.imageUrl} className="w-full h-full object-cover" />

                      <div className={`absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center transition-opacity backdrop-blur-[2px] ${repl ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}>
                        <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Replace</span>
                      </div>

                      {!repl && (
                        <button type="button" onClick={(e) => handleDeleteImage(img.id, e)} className="absolute top-1 left-1 w-6 h-6 bg-red-500 text-white rounded-md flex items-center justify-center hover:bg-red-600 shadow-md z-[60] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto" title="Delete image">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}

                      {repl ? (
                        <>
                          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemoveReplacement(img.id); }} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-600 shadow-md z-[60] cursor-pointer pointer-events-auto">
                            ✕
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-blue-500 text-white text-[8px] font-bold text-center py-0.5 uppercase tracking-widest z-10 pointer-events-none">
                            New Input
                          </div>
                        </>
                      ) : (
                        <input type="file" onChange={(e) => handleImageReplace(img.id, e)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" accept="image/*" title="Replace image" />
                      )}
                    </div>
                  );
                })}

                {newImages.map((img, idx) => (
                  <div key={`new-${idx}`} className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-brand-accent shrink-0 group">
                    <img src={URL.createObjectURL(img)} className="w-full h-full object-cover" />
                    <button type="button" onClick={(e) => { e.preventDefault(); removeNewImage(idx); }} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-600 shadow-md z-[60] cursor-pointer">
                      ✕
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-brand-accent text-white text-[8px] font-bold text-center py-0.5 uppercase tracking-widest pointer-events-none">
                      New
                    </div>
                  </div>
                ))}

                {existingImages.length + newImages.length < 5 && (
                  <label className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-dashed border-slate-300 shrink-0 flex items-center justify-center text-slate-400 hover:text-brand-accent hover:border-brand-accent transition-colors bg-slate-50 cursor-pointer group">
                    <span className="text-2xl font-light group-hover:scale-110 transition-transform">+</span>
                    <input type="file" multiple onChange={handleAddNewImages} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10" accept="image/*" title="Add new images" />
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-4">
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 px-6 py-4 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-[2] premium-button bg-brand-accent text-white shadow-xl shadow-brand-accent/20 py-4 flex items-center justify-center gap-2">
              {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Processing...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const MAX_AUCTION_DURATION_MINUTES = 30;

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
    if (!startingPrice || !minBidIncrement || !startDate || !startTime || !durationMinutes) {
      return onError("Please fill in all required fields.");
    }

    try {
      setLoading(true);

      const startDateTime = new Date(`${startDate}T${startTime}`);
      const duration = parseInt(durationMinutes);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

      const payload = {
        ProductId: product.id || product.Id,
        StartingPrice: parseFloat(startingPrice),
        ReservePrice: reservePrice ? parseFloat(reservePrice) : null,
        MinBidIncrement: parseFloat(minBidIncrement),
        StartDate: startDateTime.toLocaleString('sv-SE').replace(' ', 'T'),
        EndDate: endDateTime.toLocaleString('sv-SE').replace(' ', 'T')
      };

      // [SMART CHECK] If an auction already exists for this product, we should use PATCH instead of POST /api/verify/auction.
      let existingAuctionId = null;
      let existingAuction = null;
      try {
        const checkRes = await api.get(`/api/auctions?productId=${product.id || product.Id}`);
        if (checkRes.success && checkRes.data && (checkRes.data as any).items && (checkRes.data as any).items.length > 0) {
          existingAuction = (checkRes.data as any).items[0];
          existingAuctionId = existingAuction.id || existingAuction.Id;
        }
      } catch (e) { console.error("Error checking for existing auction:", e); }

      let res;
      if (existingAuctionId) {
        const hasBids = existingAuction ? (existingAuction.totalBids > 0 || existingAuction.TotalBids > 0) : false;

        const patchPayload: any = {
          ReservePrice: reservePrice ? parseFloat(reservePrice) : null,
          MinBidIncrement: parseFloat(minBidIncrement),
          StartDate: startDateTime.toLocaleString('sv-SE').replace(' ', 'T'),
          EndDate: endDateTime.toLocaleString('sv-SE').replace(' ', 'T')
        };

        if (!hasBids) {
          patchPayload.StartingPrice = parseFloat(startingPrice);
        }

        // If it exists, use the update (PATCH) endpoint correctly as per user request
        res = await api.patch(`/api/auctions/${existingAuctionId}`, patchPayload, false);
      } else {
        // Otherwise, use the initial launch (POST) endpoint
        res = await api.post('/api/verify/auction', payload, false);
      }

      if (res.success) {
        onSuccess();
      } else {
        onError(res.message || "Failed to process auction launch.");
      }
    } catch (err: any) {
      onError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pt-28 pb-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
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
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 font-bold">₹</span>
                  <input type="number" min="0" step="0.01" value={startingPrice} onChange={e => setStartingPrice(e.target.value)} required className="w-full pl-8 pr-5 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all" placeholder="0.00" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="block text-sm font-bold text-slate-700">Reserve Price (₹)</label>
                  <div className="group relative flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-500 text-[10px] font-bold cursor-help border border-blue-100">
                    i
                    <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-slate-900 text-white text-xs rounded-lg shadow-xl -left-20 z-10">
                      Optional: The minimum amount you expect to win. Auction won't complete if this target isn't met.
                    </div>
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 font-bold">₹</span>
                  <input type="number" min="0" step="0.01" value={reservePrice} onChange={e => setReservePrice(e.target.value)} className="w-full pl-8 pr-5 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all" placeholder="Optional" />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Min Bid Increment (₹)</label>
              <div className="relative">
                <span className="absolute left-4 top-3 text-slate-400 font-bold">₹</span>
                <input type="number" min="0" step="0.01" value={minBidIncrement} onChange={e => setMinBidIncrement(e.target.value)} required className="w-full pl-8 pr-5 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all" placeholder="e.g. 50" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Start Date</label>
                <input type="date" min={new Date().toLocaleString('sv-SE').replace(' ', 'T').split('T')[0]} value={startDate} onChange={e => setStartDate(e.target.value)} required className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all text-slate-700" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Start Time</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all text-slate-700" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Duration (Minutes)</label>
              <input type="number" min="1" max={MAX_AUCTION_DURATION_MINUTES} value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} required className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 outline-none transition-all" placeholder="Max 30 mins" />
              <p className="text-xs text-slate-400 mt-2 font-medium">Max duration is {MAX_AUCTION_DURATION_MINUTES} minutes.</p>
            </div>

          </div>

          <div className="pt-4 flex gap-4">
            <button type="button" onClick={onClose} disabled={loading} className="flex-1 px-6 py-4 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-[2] premium-button bg-brand-accent text-white shadow-xl shadow-brand-accent/20 py-4 flex items-center justify-center gap-2">
              {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
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
    } else {
      setStartingPrice('');
      setReservePrice('');
      setMinBidIncrement('');
      setStartDate('');
      setStartTime('');
      setDurationMinutes('');
      setAuctionId(null);
    }
  }, [isOpen, product]);

  const fetchAuctionDetails = async () => {
    setFetching(true);
    try {
      const res = await api.get('/api/auctions/created');
      if (res.success && res.data) {
        const auctions = res.data as any[];
        const myAuction = auctions.find(a => (a.productId || a.ProductId) === (product.id || product.Id));
        if (myAuction) {
          setAuctionId(myAuction.id || myAuction.Id);
          setStartingPrice(myAuction.startingPrice?.toString() || myAuction.StartingPrice?.toString() || '');
          setReservePrice(myAuction.reservePrice?.toString() || myAuction.ReservePrice?.toString() || '');
          setMinBidIncrement(myAuction.minBidIncrement?.toString() || myAuction.MinBidIncrement?.toString() || '');

          const sDateRaw = myAuction.startDate || myAuction.StartDate;
          if (sDateRaw) {
            const sd = new Date(sDateRaw);
            setStartDate(sd.getFullYear() + "-" + String(sd.getMonth() + 1).padStart(2, '0') + "-" + String(sd.getDate()).padStart(2, '0'));
            setStartTime(String(sd.getHours()).padStart(2, '0') + ":" + String(sd.getMinutes()).padStart(2, '0'));

            const eDateRaw = myAuction.endDate || myAuction.EndDate;
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
          onError("Could not find the auction details.");
          onClose();
        }
      } else {
        onError("Failed to fetch auction details.");
        onClose();
      }
    } catch (err) {
      onError("Error loading auction details.");
      onClose();
    } finally {
      setFetching(false);
    }
  };

  if (!isOpen || !product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auctionId) return onError("Auction ID missing.");

    try {
      setLoading(true);

      let startDateTime: Date | null = null;
      let endDateTime: Date | null = null;

      if (startDate && startTime) {
        startDateTime = new Date(`${startDate}T${startTime}`);
        if (durationMinutes) {
          const duration = parseInt(durationMinutes);
          endDateTime = new Date(startDateTime.getTime() + duration * 60000);
        }
      }

      const payload = {
        StartingPrice: startingPrice ? parseFloat(startingPrice) : null,
        ReservePrice: reservePrice ? parseFloat(reservePrice) : null,
        MinBidIncrement: minBidIncrement ? parseFloat(minBidIncrement) : null,
        StartDate: startDateTime ? startDateTime.toLocaleString('sv-SE').replace(' ', 'T') : null,
        EndDate: endDateTime ? endDateTime.toLocaleString('sv-SE').replace(' ', 'T') : null
      };

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

  if (fetching) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pt-28 pb-8 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-2xl flex flex-col items-center shadow-2xl animate-in zoom-in">
          <div className="w-10 h-10 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-bold text-slate-800 tracking-wide">Loading auction details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pt-28 pb-8 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-xl my-8 overflow-hidden animate-in fade-in zoom-in duration-300 relative">
        <header className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Update Auction</h3>
            <p className="text-slate-500 text-sm mt-1">Modify settings for {product.name || product.Name}</p>
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
                <div className="relative">
                  <span className="absolute left-4 top-3 text-slate-400 font-bold">₹</span>
                  <input type="number" min="0" step="0.01" value={startingPrice} onChange={e => setStartingPrice(e.target.value)} className="w-full pl-8 pr-5 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all" placeholder="Optional" />
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
            <button type="submit" disabled={loading} className="flex-[2] premium-button bg-amber-500 text-white shadow-xl shadow-amber-500/20 py-4 flex items-center justify-center gap-2 hover:bg-amber-600">
              {loading && <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Updating...' : 'Update Auction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
