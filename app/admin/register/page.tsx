'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function AdminRegister() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      formData.append('Role', 'ADMIN');

      if (data.profileImage?.[0]) {
        formData.append('file', data.profileImage[0]);
      }

      const res = await api.post('/api/admin/signup', formData, true);
      console.log(res)
      if (res.success) {
        router.push('/admin/login');
      } else {
        setError(res.message || 'Registration failed');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
      <div className="premium-card w-full max-w-md p-8 bg-white shadow-xl">
        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-brand-accent/10 rounded-full mb-3">
            <svg className="w-8 h-8 text-brand-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-1.016A11.042 11.042 0 0012 3c-5.111 0-9.423 3.3-10.954 7.984a11.046 11.046 0 000 8.032C2.577 23.7 6.889 27 12 27s9.423-3.3 10.954-7.984a11.046 11.046 0 000-8.032z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-brand-accent">Admin Registration</h1>
          <p className="text-sm text-slate-500 mt-1">Create an administrative account</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md mb-6 border border-red-100 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Full Name</label>
            <input
              {...register('name', { required: 'Name is required' })}
              className="premium-input"
              placeholder="Admin Name"
            />
            {errors.name && <span className="text-red-500 text-xs text-brand-dark">{(errors.name as any).message}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <input
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' }
              })}
              className="premium-input"
              placeholder="admin@auction.com"
            />
            {errors.email && <span className="text-red-500 text-xs">{(errors.email as any).message}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 characters' } })}
              type="password"
              className="premium-input"
              placeholder="••••••••"
            />
            {errors.password && <span className="text-red-500 text-xs">{(errors.password as any).message}</span>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone Number</label>
              <input
                {...register('phone', { required: 'Phone is required' })}
                className="premium-input"
                placeholder="8945762318"
              />
              {errors.phone && <span className="text-red-500 text-xs">{(errors.phone as any).message}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <input
                {...register('address', { required: 'Address is required' })}
                className="premium-input"
                placeholder="Surat, Gujarat, India"
              />
              {errors.address && <span className="text-red-500 text-xs">{(errors.address as any).message}</span>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Avatar Image</label>
            <input
              {...register('profileImage')}
              type="file"
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-light file:text-brand-accent hover:file:bg-brand-medium"
              accept="image/*"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="premium-button w-full mt-6 bg-brand-accent text-white"
          >
            {loading ? 'Creating Account...' : 'Register as Admin'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-600">
          Already have an admin account? <Link href="/admin/login" className="text-brand-accent font-semibold hover:underline">Login here</Link>
        </p>
      </div>
    </div>
  );
}
