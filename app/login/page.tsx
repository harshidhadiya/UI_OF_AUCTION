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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');

  useEffect(() => {
    // If already logged in, skip login page
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
        const res = await api.post<any>('/api/user/login', {
          email: data.email,
          password: data.password,
          role: 'USER'
        });

        if (res.success) {
          auth.setIsAdmin(false);
          try {
            const profileRes = await api.get<any>('/api/user/profile/0');
            const d = profileRes?.data ?? profileRes;
            if (d && (d.id || d.Id)) {
              auth.setUser({
                id: d.id ?? d.Id,
                name: d.name ?? d.Name,
                email: d.email ?? d.Email,
                phone: d.phone ?? d.Phone,
                address: d.address ?? d.Address,
                imageUrl: d.imageUrl ?? d.ImageUrl,
                role: d.role ?? d.Role,
              });
            } else {
              auth.setUser(res.data);
            }
          } catch {
            auth.setUser(res.data);
          }
          router.push('/dashboard');
        } else {
          setError(res.message || 'Login failed');
        }
      } else {
        // ADMIN LOGIN
        const res = await api.post<any>('/api/admin/Login', {
          email: data.email,
          password: data.password,
          role: 'ADMIN'
        });

        if (res.success) {
          auth.setIsAdmin(true);
          try {
            const profileRes = await api.get<any>('/api/admin/profile');
            const d = profileRes?.data ?? profileRes;
            if (d && (d.id || d.Id)) {
              auth.setUser({
                id: d.id ?? d.Id,
                name: d.name ?? d.Name,
                email: d.email ?? d.Email,
                phone: d.phone ?? d.Phone,
                address: d.address ?? d.Address,
                imageUrl: d.imageUrl ?? d.ImageUrl,
                role: d.role ?? d.Role ?? 'ADMIN',
                requestObj: (d.obj || d.Obj) ? (() => {
                  const o = d.obj ?? d.Obj;
                  return {
                    id: o.id ?? o.Id,
                    name: o.name ?? o.Name,
                    email: o.email ?? o.Email,
                    requestUserId: o.requestUserId ?? o.RequestUserId,
                    verifierId: o.verifierId ?? o.VerifierId,
                    verifiedByAdmin: o.verifiedByAdmin ?? o.VerifiedByAdmin,
                    hasRightToAdd: o.hasRightToAdd ?? o.HasRightToAdd,
                    createdAt: o.createdAt ?? o.CreatedAt,
                    verifiedAt: o.verifiedAt ?? o.VerifiedAt,
                    rightsGrantedAt: o.rightsGrantedAt ?? o.RightsGrantedAt,
                  };
                })() : undefined,
              });
            } else {
              auth.setUser(res.data);
            }
          } catch {
            auth.setUser(res.data);
          }
          router.push('/admin/dashboard');
        } else {
          setError(res.message || 'Authentication failed');
        }
      }
    } catch (err) {
      console.log(err);
      setError('Invalid credentials or server error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-accent/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-brand-accent/5 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-accent rounded-2xl shadow-xl shadow-brand-accent/20 mb-4 transform -rotate-6">
            <span className="text-white text-2xl font-black">A</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Welcome Back</h1>
          <p className="text-slate-500 font-medium">Access the most premium auction experience.</p>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-8 border border-slate-100 backdrop-blur-sm bg-white/90">
          {/* Role Switcher */}
          <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
            <button
              onClick={() => { setRole('USER'); setError(''); }}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${role === 'USER' ? 'bg-white text-brand-accent shadow-sm scale-100' : 'text-slate-400 hover:text-slate-600 scale-95'}`}
            >
              Auctioneer
            </button>
            <button
              onClick={() => { setRole('ADMIN'); setError(''); }}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${role === 'ADMIN' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-100' : 'text-slate-400 hover:text-slate-600 scale-95'}`}
            >
              Administrator
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 border border-red-100 text-xs font-bold animate-in fade-in slide-in-from-top-2">
              <div className="flex gap-2 items-center">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Identity (Email)</label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-accent transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" /></svg>
                  </span>
                  <input
                    {...register('email', { required: 'Email is required' })}
                    type="email"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/5 transition-all font-medium text-slate-700"
                    placeholder="name@company.com"
                  />
                </div>
                {errors.email && <span className="text-red-500 text-[10px] font-black ml-1 uppercase tracking-wider">{(errors.email as any).message}</span>}
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 ml-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Secret Key</label>
                  <Link href="#" className="text-[10px] font-black text-brand-accent/60 uppercase tracking-widest hover:text-brand-accent transition-colors">Forgot?</Link>
                </div>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-accent transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  </span>
                  <input
                    {...register('password', { required: 'Password is required' })}
                    type="password"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/5 transition-all font-medium text-slate-700"
                    placeholder="••••••••"
                  />
                </div>
                {errors.password && <span className="text-red-500 text-[10px] font-black ml-1 uppercase tracking-wider">{(errors.password as any).message}</span>}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-5 rounded-[1.25rem] font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95 disabled:grayscale ${role === 'USER' ? 'bg-brand-accent text-white shadow-xl shadow-brand-accent/20 hover:bg-brand-accent/90' : 'bg-slate-900 text-white shadow-xl shadow-slate-900/20 hover:bg-slate-800'}`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Establish Session
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-50 text-center">
            <p className="text-sm text-slate-400 font-medium">
              New to the platform? <Link href="/register" className="text-brand-accent font-black hover:text-brand-accent/80 transition-colors underline-offset-4 decoration-2">Create Global Account</Link>
            </p>
          </div>
        </div>
        
        <p className="text-center mt-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">
          Secure, Encrypted & Premium Auction Experience
        </p>
      </div>
    </div>
  );
}
