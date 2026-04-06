'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import Link from 'next/link';

export default function Login() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [role, setRole]         = useState<'USER' | 'ADMIN'>('USER');
  const [mounted, setMounted]   = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = auth.getUser();
    if (user) {
      router.replace(user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard');
    }
  }, [router]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError('');
    try {
      if (role === 'USER') {
        const res = await api.post<any>('/api/user/login', { email: data.email, password: data.password, role: 'USER' });
        if (res.success) {
          auth.setIsAdmin(false);
          try {
            const profileRes = await api.get<any>('/api/user/profile');
            const d = profileRes?.data ?? profileRes;
            if (d && (d.id || d.Id)) {
              auth.setUser({ id: d.id ?? d.Id, name: d.name ?? d.Name, email: d.email ?? d.Email, phone: d.phone ?? d.Phone, address: d.address ?? d.Address, imageUrl: d.imageUrl ?? d.ImageUrl, role: d.role ?? d.Role });
            } else { auth.setUser(res.data); }
          } catch { auth.setUser(res.data); }
          router.push('/dashboard');
        } else { setError(res.message || 'Login failed'); }
      } else {
        const res = await api.post<any>('/api/admin/Login', { email: data.email, password: data.password, role: 'ADMIN' });
        if (res.success) {
          auth.setIsAdmin(true);
          try {
            const profileRes = await api.get<any>('/api/admin/profile');
            const d = profileRes?.data ?? profileRes;
            if (d && (d.id || d.Id)) {
              auth.setUser({
                id: d.id ?? d.Id, name: d.name ?? d.Name, email: d.email ?? d.Email, phone: d.phone ?? d.Phone,
                address: d.address ?? d.Address, imageUrl: d.imageUrl ?? d.ImageUrl, role: d.role ?? d.Role ?? 'ADMIN',
                requestObj: (d.obj || d.Obj) ? (() => {
                  const o = d.obj ?? d.Obj;
                  return { id: o.id ?? o.Id, name: o.name ?? o.Name, email: o.email ?? o.Email, requestUserId: o.requestUserId ?? o.RequestUserId, verifierId: o.verifierId ?? o.VerifierId, verifiedByAdmin: o.verifiedByAdmin ?? o.VerifiedByAdmin, hasRightToAdd: o.hasRightToAdd ?? o.HasRightToAdd, createdAt: o.createdAt ?? o.CreatedAt, verifiedAt: o.verifiedAt ?? o.VerifiedAt, rightsGrantedAt: o.rightsGrantedAt ?? o.RightsGrantedAt };
                })() : undefined,
              });
            } else { auth.setUser(res.data); }
          } catch { auth.setUser(res.data); }
          router.push('/admin/dashboard');
        } else { setError(res.message || 'Authentication failed'); }
      }
    } catch { setError('Invalid credentials or server error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-[#FAF7F0] overflow-hidden">

      {/* ── LEFT HERO PANEL ── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] relative overflow-hidden p-12 xl:p-16">
        {/* Yellow blob */}
        <div className="yellow-blob animate-float-y" />

        {/* Trust row */}
        <div className={`relative z-10 flex items-center gap-2 ${mounted ? 'animate-slide-right' : 'opacity-0'}`}>
          <div className="flex text-[#111]">
            {[...Array(4)].map((_, i) => (
              <svg key={i} className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            ))}
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none"><defs><linearGradient id="hstar"><stop offset="50%" stopColor="#111"/><stop offset="50%" stopColor="transparent"/></linearGradient></defs><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" fill="url(#hstar)" stroke="#111" strokeWidth="1"/></svg>
          </div>
          <span className="text-sm font-bold text-[#111]"><span className="font-black">4.8 stars</span> based on 2,40,000+ auctions</span>
        </div>

        {/* Big headline */}
        <div className="relative z-10 mt-6">
          {['INSTANT BID.', 'LIVE AUCTION.', 'FAST WIN.'].map((line, i) => (
            <div
              key={i}
              className={`display-heading text-[#111] leading-none select-none ${mounted ? 'animate-text-reveal' : 'opacity-0'}`}
              style={{
                fontSize: 'clamp(3rem, 5.5vw, 5.5rem)',
                animationDelay: `${i * 120}ms`
              }}
            >
              {line}
            </div>
          ))}
          <p className={`mt-6 text-base text-[#6B6557] font-medium max-w-sm leading-relaxed ${mounted ? 'animate-slide-up animate-delay-4' : 'opacity-0'}`}>
            Sell your products, bid on exclusive items, and win — with no hoops, haggles, or headaches.
          </p>
        </div>

        {/* Scroll down hint */}
        <div className={`relative z-10 ${mounted ? 'animate-fade-in animate-delay-6' : 'opacity-0'}`}>
          <button className="w-10 h-10 rounded-full border-2 border-[#111]/30 flex items-center justify-center hover:border-[#111] transition-colors">
            <svg className="w-4 h-4 text-[#111]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className={`flex-1 lg:w-[48%] flex flex-col justify-center items-center px-6 py-12 bg-white lg:shadow-[-20px_0_60px_rgba(0,0,0,0.06)] ${mounted ? 'animate-slide-left' : 'opacity-0'}`}>
        <div className="w-full max-w-md">

          {/* Logo (mobile only) */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 bg-[#FFD000] rounded-xl flex items-center justify-center shadow-[0_4px_14px_rgba(255,208,0,0.45)]">
              <span className="text-[#111] text-base font-black">A</span>
            </div>
            <span className="text-xl font-black tracking-tight text-[#111] lowercase">macuction</span>
          </div>

          {/* Header */}
          <h1 className="text-3xl font-black text-[#111] tracking-tight mb-1">Welcome Back</h1>
          <p className="text-[#6B6557] font-medium mb-8">Access your premium auction experience.</p>

          {/* Role tab switcher — Peddle style dark/light tabs */}
          <div className="flex rounded-2xl overflow-hidden border-2 border-[#111] mb-8">
            {(['USER', 'ADMIN'] as const).map((r) => (
              <button
                key={r}
                onClick={() => { setRole(r); setError(''); }}
                className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest transition-all ${role === r ? 'bg-[#111] text-[#FAF7F0]' : 'bg-white text-[#6B6557] hover:bg-[#FAF7F0]'}`}
              >
                {r === 'USER' ? 'Auctioneer' : 'Administrator'}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3.5 mb-6 text-xs font-bold flex items-center gap-2 animate-slide-down">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-2">Email Address</label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B8B0A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" /></svg>
                <input
                  {...register('email', { required: 'Email is required' })}
                  type="email"
                  className="w-full pl-10 pr-4 py-3.5 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl outline-none focus:border-[#FFD000] focus:bg-white focus:ring-4 focus:ring-[#FFD000]/15 transition-all text-[#111] font-medium text-sm"
                  placeholder="name@company.com"
                />
              </div>
              {errors.email && <p className="text-red-500 text-[10px] font-black mt-1 uppercase tracking-wider">{(errors.email as any).message}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[10px] font-black text-[#6B6557] uppercase tracking-widest">Password</label>
              </div>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B8B0A0]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                <input
                  {...register('password', { required: 'Password is required' })}
                  type="password"
                  className="w-full pl-10 pr-4 py-3.5 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl outline-none focus:border-[#FFD000] focus:bg-white focus:ring-4 focus:ring-[#FFD000]/15 transition-all text-[#111] font-medium text-sm"
                  placeholder="••••••••"
                />
              </div>
              {errors.password && <p className="text-red-500 text-[10px] font-black mt-1 uppercase tracking-wider">{(errors.password as any).message}</p>}
            </div>

            {/* CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full cta-button h-14 text-sm mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-[#111]/30 border-t-[#111] rounded-full animate-spin" /> Processing...</>
                : <>{role === 'USER' ? 'Access Platform' : 'Admin Login'} <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></>
              }
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#E5DFD3] text-center">
            <p className="text-sm text-[#6B6557] font-medium">
              New here?{' '}
              <Link href="/register" className="text-[#111] font-black hover:text-[#FFD000] transition-colors underline underline-offset-2">
                Create Account →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
