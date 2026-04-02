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
  const [error, setError] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');

  useEffect(() => {
    // If already logged in, skip register page
    const user = auth.getUser();
    if (user) {
      router.replace(user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard');
    }
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
      if (data.profileImage?.[0]) {
        formData.append('file', data.profileImage[0]);
      }

      if (role === 'USER') {
        const res = await api.post('/api/user/create', formData, true);
        if (res.success) {
          router.push('/login');
        } else {
          setError(res.message || 'Registration failed');
        }
      } else {
        const res = await api.post('/api/admin/signup', formData, true);
        if (res.success) {
          router.push('/login');
        } else {
          setError(res.message || 'Registration failed');
        }
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-accent/5 rounded-full blur-3xl opacity-50" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-brand-accent/5 rounded-full blur-3xl opacity-50" />

      <div className="w-full max-w-xl relative">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-accent rounded-2xl shadow-xl shadow-brand-accent/20 mb-4 transform rotate-6">
            <span className="text-white text-2xl font-black">A</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Create Global Account</h1>
          <p className="text-slate-500 font-medium text-sm">Join the most premium auction network.</p>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/40 p-8 md:p-10 border border-slate-100 backdrop-blur-sm bg-white/95">
          {/* Role Switcher */}
          <div className="flex p-1 bg-slate-100 rounded-2xl mb-8">
            <button
              onClick={() => { setRole('USER'); setError(''); }}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${role === 'USER' ? 'bg-white text-brand-accent shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Auctioneer
            </button>
            <button
              onClick={() => { setRole('ADMIN'); setError(''); }}
              className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${role === 'ADMIN' ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Administrator
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 border border-red-100 text-xs font-bold animate-in fade-in slide-in-from-top-2 flex items-center gap-3">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Full Name</label>
                <input
                  {...register('name', { required: 'Name is required' })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/5 transition-all font-medium text-slate-700"
                  placeholder="Johnathan Doe"
                />
                {errors.name && <span className="text-red-500 text-[10px] font-black ml-1 uppercase tracking-wider block mt-1">{(errors.name as any).message}</span>}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                <input
                  {...register('email', {
                    required: 'Email is required',
                    pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' }
                  })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/5 transition-all font-medium text-slate-700"
                  placeholder="john@example.com"
                />
                {errors.email && <span className="text-red-500 text-[10px] font-black ml-1 uppercase tracking-wider block mt-1">{(errors.email as any).message}</span>}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Secret Key (Password)</label>
                <input
                  {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
                  type="password"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/5 transition-all font-medium text-slate-700"
                  placeholder="••••••••"
                />
                {errors.password && <span className="text-red-500 text-[10px] font-black ml-1 uppercase tracking-wider block mt-1">{(errors.password as any).message}</span>}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Mobile Contact</label>
                <input
                  {...register('phone', { required: 'Mobile number is required' })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/5 transition-all font-medium text-slate-700"
                  placeholder="+91 98765 43210"
                />
                {errors.phone && <span className="text-red-500 text-[10px] font-black ml-1 uppercase tracking-wider block mt-1">{(errors.phone as any).message}</span>}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Physical Address</label>
                <input
                  {...register('address', { required: 'Address is required' })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/5 transition-all font-medium text-slate-700"
                  placeholder="City, State, Country"
                />
                {errors.address && <span className="text-red-500 text-[10px] font-black ml-1 uppercase tracking-wider block mt-1">{(errors.address as any).message}</span>}
              </div>

              <div className="col-span-1 md:col-span-2 space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Profile Identity (Image)</label>
                <div className="relative group border-2 border-dashed border-slate-100 rounded-[1.5rem] p-4 hover:border-brand-accent/30 transition-all bg-slate-50/50">
                  <input
                    {...register('profileImage')}
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    accept="image/*"
                  />
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-300 group-hover:text-brand-accent transition-colors">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Image</p>
                      <p className="text-[10px] text-slate-400 font-medium">PNG, JPG, SVG up to 5MB</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-5 rounded-[1.25rem] font-black text-sm uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:grayscale mt-4 ${role === 'USER' ? 'bg-brand-accent text-white shadow-xl shadow-brand-accent/20 hover:bg-brand-accent/90' : 'bg-slate-900 text-white shadow-xl shadow-slate-900/20 hover:bg-slate-800'}`}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Establish Global Account
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-50 text-center">
            <p className="text-sm text-slate-400 font-medium">
              Already a member? <Link href="/login" className="text-brand-accent font-black hover:text-brand-accent/80 transition-colors underline-offset-4 decoration-2">Access Portal</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
