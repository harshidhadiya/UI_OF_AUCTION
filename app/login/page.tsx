'use client';
import { useState } from 'react';
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

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/user/login', {
        email: data.email,
        password: data.password,
        role: 'USER'
      });
      console.log(res);
      if (res.success) {
        console.log(res.data);
        auth.setToken(res.data.token);
        auth.setUser(res.data);
        router.push('/dashboard');
      } else {
        setError(res.message || 'Login failed');
      }
    } catch (err) {
      setError('Invalid credentials or server error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="premium-card w-full max-w-md p-8 bg-white shadow-xl">
        <h1 className="text-3xl font-bold mb-6 text-brand-accent text-center">User Login</h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-6 border border-red-100 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Email Address</label>
            <input
              {...register('email', { required: 'Email is required' })}
              type="email"
              className="premium-input"
              placeholder="user@example.com"
            />
            {errors.email && <span className="text-red-500 text-xs text-brand-dark">{(errors.email as any).message}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-slate-700">Password</label>
            <input
              {...register('password', { required: 'Password is required' })}
              type="password"
              className="premium-input"
              placeholder="••••••••"
            />
            {errors.password && <span className="text-red-500 text-xs">{(errors.password as any).message}</span>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="premium-button w-full mt-6 bg-brand-accent text-white hover:bg-brand-accent/90 shadow-brand-accent/20 shadow-lg"
          >
            {loading ? 'Authenticating...' : 'Sign In as User'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-600">
          New to Auction Central? <Link href="/register" className="text-brand-accent font-semibold hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
