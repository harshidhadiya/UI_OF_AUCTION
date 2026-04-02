'use client';
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    
    const checkAuthAndRedirect = async () => {
      try {
        console.log('[Root] Initializing session check...');
        // We add a safety timeout as well
        const timeout = setTimeout(() => {
          if (active) {
            console.log('[Root] Redirection timeout fallback...');
            router.replace('/login');
          }
        }, 5000);

        const ok = await auth.tryRefresh();
        clearTimeout(timeout);
        
        if (!active) return;

        if (ok) {
          const user = auth.getUser();
          console.log('[Root] Session active, role:', user?.role);
          if (user?.role === 'ADMIN') {
            router.replace('/admin/dashboard');
          } else {
            router.replace('/dashboard');
          }
        } else {
          console.log('[Root] No active session, heading to login');
          router.replace('/login');
        }
      } catch (err) {
        console.error('[Root] Redirection error:', err);
        if (active) router.replace('/login');
      }
    };

    checkAuthAndRedirect();
    return () => { active = false; };
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center">
        <div className="relative">
          <div className="w-20 h-20 bg-brand-accent rounded-[2rem] mb-8 flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-brand-accent/20 animate-bounce">
            A
          </div>
          <div className="absolute inset-0 bg-brand-accent/20 rounded-[2rem] animate-ping" />
        </div>
        
        <div className="h-1.5 w-64 bg-slate-100 rounded-full overflow-hidden mb-4 p-[1px]">
          <div className="h-full bg-brand-accent w-full origin-left animate-[loading_1.5s_infinite_ease-in-out]" />
        </div>
        
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] ml-[0.3em] animate-pulse">
          Establishing Secure Session
        </p>
      </div>
      
      <style jsx>{`
        @keyframes loading {
          0% { transform: scaleX(0); transform-origin: left; }
          50% { transform: scaleX(1); transform-origin: left; }
          51% { transform: scaleX(1); transform-origin: right; }
          100% { transform: scaleX(0); transform-origin: right; }
        }
      `}</style>
    </div>
  );
}
