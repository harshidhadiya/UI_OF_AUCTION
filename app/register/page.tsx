'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function Register() {
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
      formData.append('Phone', data.Phone);
      formData.append('Address', data.address);
      formData.append('Role', 'USER');
      if (data.profileImage?.[0]) {
        formData.append('file', data.profileImage[0]);
      }

      const res = await api.post('/api/user/create', formData, true);
      if (res.success) {
        router.push('/login');
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="premium-card w-full max-w-md p-8 bg-white shadow-xl">
        <h1 className="text-3xl font-bold mb-6 text-brand-accent text-center">User Registration</h1>

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
              placeholder="John Doe"
            />
            {errors.name && <span className="text-red-500 text-xs">{(errors.name as any).message}</span>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <input
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' }
              })}
              className="premium-input"
              placeholder="john@example.com"
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
              <label className="block text-sm font-medium mb-1">Mobile Number</label>
              <input
                {...register('Phone', { required: 'Mobile number is required' })}
                className="premium-input"
                placeholder="1234567890"
              />
              {errors.Phone && <span className="text-red-500 text-xs">{(errors.Phone as any).message}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <input
                {...register('address', { required: 'Address is required' })}
                className="premium-input"
                placeholder="Your full address"
              />
              {errors.address && <span className="text-red-500 text-xs">{(errors.address as any).message}</span>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Profile Image</label>
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
            {loading ? 'Creating Account...' : 'Register as User'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-slate-600">
          Already have an account? <Link href="/login" className="text-brand-accent font-semibold hover:underline">Login here</Link>
        </p>
      </div>
    </div>
  );
}
