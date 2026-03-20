'use client';
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-brand-dark to-brand-accent text-white">
      <h1 className="text-5xl font-bold mb-4 tracking-tight">Auction Central</h1>
      <p className="text-xl mb-12 opacity-90 max-w-md text-center">
        The most advanced, premium auction platform for real business.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <div className="premium-card p-8 flex flex-col items-center bg-white/10 backdrop-blur-md border-white/20">
          <h2 className="text-2xl font-semibold mb-4">User Portal</h2>
          <div className="flex flex-col gap-3 w-full">
            <Link href="/login" className="premium-button bg-white text-brand-accent hover:bg-white/90 text-center">
              Login as User
            </Link>
            <Link href="/register" className="premium-button bg-transparent border border-white hover:bg-white/10 text-center">
              Register as User
            </Link>
          </div>
        </div>
        
        <div className="premium-card p-8 flex flex-col items-center bg-white/10 backdrop-blur-md border-white/20">
          <h2 className="text-2xl font-semibold mb-4">Admin Portal</h2>
          <div className="flex flex-col gap-3 w-full">
            <Link href="/admin/login" className="premium-button bg-brand-medium text-brand-accent hover:bg-brand-medium/90 text-center">
              Login as Admin
            </Link>
            <Link href="/admin/register" className="premium-button bg-transparent border border-white hover:bg-white/10 text-center">
              Register as Admin
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
