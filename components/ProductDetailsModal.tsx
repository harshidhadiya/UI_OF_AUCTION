'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';

interface ProductDetailsModalProps {
  isOpen: boolean;
  product: any;
  onClose: () => void;
  currentUser: any;
  onLaunchAuction?: (product: any) => void;
}

export default function ProductDetailsModal({ isOpen, product, onClose, currentUser, onLaunchAuction }: ProductDetailsModalProps) {
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
      const res = await api.get(`/api/user/profile?id=${userId}`);
      if (res.success) {
        setOwnerInfo(res.data);
        setShowOwner(true);
      }
    } catch (err) {
      // silently fail
    } finally {
      setLoadingOwner(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-y-auto modal-backdrop">
      {/* Lightbox Overlay */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setFullscreenImage(null)}
        >
          <img src={fullscreenImage} alt="Full Screen" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg transition-transform hover:scale-[1.02]" />
          <button className="absolute top-8 right-8 text-white/50 hover:text-white text-2xl">✕</button>
        </div>
      )}

      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden modal-content relative my-8 border border-slate-100">
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
              <div className="mt-3 p-5 bg-white rounded-2xl border border-slate-100 shadow-xl shadow-slate-900/5 animate-slide-up">
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
