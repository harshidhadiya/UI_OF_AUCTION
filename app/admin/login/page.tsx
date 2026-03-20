'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { auth } from '@/lib/auth';
import Link from 'next/link';

export default function AdminLogin() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/admin/Login', {
        email: data.email,
        password: data.password,
        role: 'ADMIN'
      });
      console.log(res);
      if (res.success) {
        auth.setToken(res.data.token);
        auth.setUser(res.data);
        router.push('/admin/dashboard');
      } else {
        setError(res.message || 'Authentication failed');
      }
    } catch (err) {
      setError('Invalid admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
      <div className="premium-card w-full max-w-md p-8 bg-white shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="p-4 bg-red-500/10 rounded-full mb-4">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">Admin Secure Access</h1>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 border-l-4 border-red-600 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-700 uppercase tracking-wider">Email Address</label>
            <input
              {...register('email', { required: 'Email is required' })}
              type="email"
              className="premium-input h-12 bg-slate-50 focus:bg-white"
              placeholder="admin@auction.com"
            />
            {errors.email && <span className="text-red-600 text-xs mt-1 block">{(errors.email as any).message}</span>}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-slate-700 uppercase tracking-wider">Password</label>
            <input
              {...register('password', { required: 'Password is required' })}
              type="password"
              className="premium-input h-12 bg-slate-50 focus:bg-white"
              placeholder="••••••••"
            />
            {errors.password && <span className="text-red-600 text-xs mt-1 block">{(errors.password as any).message}</span>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="premium-button w-full h-12 bg-slate-900 text-white hover:bg-black transition-all transform hover:scale-[1.01]"
          >
            {loading ? 'Verifying...' : 'Access Administration'}
          </button>
        </form>

        <p className="mt-10 text-center text-sm text-slate-500">
          Need an admin account? <Link href="/admin/register" className="text-red-700 font-bold hover:underline">Request access</Link>
        </p>
      </div>
    </div>
  );
}
