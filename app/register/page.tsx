'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import Link from 'next/link';

export default function Register() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [role, setRole]       = useState<'USER' | 'ADMIN'>('USER');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const user = auth.getUser();
    if (user) router.replace(user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard');
  }, [router]);

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('Name', data.name);
      formData.append('Email', data.email);
      formData.append('Password', data.password);
      formData.append('Phone', data.phone);
      formData.append('Address', data.address);
      formData.append('Role', role);
      if (data.profileImage?.[0]) formData.append('file', data.profileImage[0]);

      const endpoint = role === 'USER' ? '/api/user/create' : '/api/admin/signup';
      const res = await api.post(endpoint, formData, true);
      if (res.success) router.push('/login');
      else setError(res.message || 'Registration failed');
    } catch { setError('Something went wrong. Please try again.'); }
    finally { setLoading(false); }
  };

  const inputCls = 'w-full px-4 py-3.5 bg-[#FAF7F0] border-2 border-[#E5DFD3] rounded-xl outline-none focus:border-[#FFD000] focus:bg-white focus:ring-4 focus:ring-[#FFD000]/15 transition-all text-[#111] font-medium text-sm placeholder:text-[#B8B0A0]';
  const labelCls = 'block text-[10px] font-black text-[#6B6557] uppercase tracking-widest mb-1.5';

  return (
    <div className="min-h-screen flex bg-[#FAF7F0] overflow-hidden">

      {/* LEFT HERO */}
      <div className="hidden lg:flex flex-col justify-between w-[48%] relative overflow-hidden p-12 xl:p-16">
        <div className="yellow-blob animate-float-y" />

        <div className={`relative z-10 flex items-center gap-2 ${mounted ? 'animate-slide-right' : 'opacity-0'}`}>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#FFD000] rounded-xl flex items-center justify-center shadow-[0_4px_14px_rgba(255,208,0,0.45)]">
              <span className="text-[#111] text-base font-black">A</span>
            </div>
            <span className="font-black text-[#111] text-lg lowercase">macuction</span>
          </div>
        </div>

        <div className="relative z-10">
          {['JOIN THE', 'PLATFORM.', 'START TODAY.'].map((line, i) => (
            <div
              key={i}
              className={`display-heading text-[#111] ${mounted ? 'animate-text-reveal' : 'opacity-0'}`}
              style={{ fontSize: 'clamp(2.8rem, 5vw, 5rem)', animationDelay: `${i * 120}ms` }}
            >
              {line}
            </div>
          ))}
          <p className={`mt-5 text-base text-[#6B6557] font-medium max-w-sm leading-relaxed ${mounted ? 'animate-slide-up animate-delay-4' : 'opacity-0'}`}>
            Create your account in minutes. List products, bid on auctions, and track everything in one place.
          </p>

          {/* Feature chips */}
          <div className={`flex flex-wrap gap-3 mt-8 ${mounted ? 'animate-slide-up animate-delay-5' : 'opacity-0'}`}>
            {['Free to Join', 'Live Bidding', 'Instant Alerts', 'Secure Payments'].map((feat) => (
              <span key={feat} className="px-3.5 py-1.5 bg-white/80 border border-[#E5DFD3] rounded-full text-[11px] font-black text-[#111] uppercase tracking-wide">
                {feat}
              </span>
            ))}
          </div>
        </div>

        <div className={`relative z-10 ${mounted ? 'animate-fade-in animate-delay-6' : 'opacity-0'}`}>
          <p className="text-[10px] font-black text-[#B8B0A0] uppercase tracking-[0.2em]">Secure & Encrypted Platform</p>
        </div>
      </div>

      {/* RIGHT FORM */}
      <div className={`flex-1 flex flex-col justify-center items-center px-6 py-10 bg-white lg:shadow-[-20px_0_60px_rgba(0,0,0,0.06)] ${mounted ? 'animate-slide-left' : 'opacity-0'}`}>
        <div className="w-full max-w-lg">

          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-9 h-9 bg-[#FFD000] rounded-xl flex items-center justify-center">
              <span className="text-[#111] font-black">A</span>
            </div>
            <span className="text-xl font-black text-[#111] lowercase">macuction</span>
          </div>

          <h1 className="text-3xl font-black text-[#111] tracking-tight mb-1">Create Account</h1>
          <p className="text-[#6B6557] font-medium mb-6">Join the premium auction network today.</p>

          {/* Role tabs */}
          <div className="flex rounded-2xl overflow-hidden border-2 border-[#111] mb-7">
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

          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3.5 mb-5 text-xs font-bold flex items-center gap-2 animate-slide-down">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className={labelCls}>Full Name</label>
              <input {...register('name', { required: 'Name is required' })} className={inputCls} placeholder="Johnathan Doe" />
              {errors.name && <p className="text-red-500 text-[10px] font-black mt-1 uppercase tracking-wider">{(errors.name as any).message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Email</label>
                <input {...register('email', { required: 'Required', pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' } })} className={inputCls} placeholder="john@example.com" />
                {errors.email && <p className="text-red-500 text-[10px] font-black mt-1">{(errors.email as any).message}</p>}
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input {...register('password', { required: 'Required', minLength: { value: 6, message: 'Min 6 chars' } })} type="password" className={inputCls} placeholder="••••••••" />
                {errors.password && <p className="text-red-500 text-[10px] font-black mt-1">{(errors.password as any).message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Phone</label>
                <input {...register('phone', { required: 'Required' })} className={inputCls} placeholder="+91 98765 43210" />
                {errors.phone && <p className="text-red-500 text-[10px] font-black mt-1">{(errors.phone as any).message}</p>}
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <input {...register('address', { required: 'Required' })} className={inputCls} placeholder="City, State" />
                {errors.address && <p className="text-red-500 text-[10px] font-black mt-1">{(errors.address as any).message}</p>}
              </div>
            </div>

            {/* Profile image upload */}
            <div>
              <label className={labelCls}>Profile Photo (optional)</label>
              <label className="flex items-center gap-4 px-4 py-3.5 bg-[#FAF7F0] border-2 border-dashed border-[#E5DFD3] rounded-xl cursor-pointer hover:border-[#FFD000] transition-colors group">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-[#E5DFD3] group-hover:border-[#FFD000] transition-colors">
                  <svg className="w-5 h-5 text-[#B8B0A0] group-hover:text-[#FFD000] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <div>
                  <p className="text-xs font-black text-[#6B6557] uppercase tracking-widest">Upload Photo</p>
                  <p className="text-[10px] text-[#B8B0A0]">PNG, JPG up to 5MB</p>
                </div>
                <input {...register('profileImage')} type="file" accept="image/*" className="sr-only" />
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full cta-button h-14 text-sm mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-[#111]/30 border-t-[#111] rounded-full animate-spin" />Creating Account...</>
                : <>Create Account <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg></>
              }
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#E5DFD3] text-center">
            <p className="text-sm text-[#6B6557] font-medium">
              Already a member?{' '}
              <Link href="/login" className="text-[#111] font-black hover:text-[#FFD000] transition-colors underline underline-offset-2">
                Sign In →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
