'use client';

import { useEffect } from 'react';

interface NotificationProps {
  type: 'success' | 'error';
  message: string;
  onDismiss: () => void;
  duration?: number;
}

export default function Notification({ type, message, onDismiss, duration = 5000 }: NotificationProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  return (
    <div
      className={`fixed bottom-8 right-8 p-4 rounded-xl shadow-2xl z-50 animate-slide-up flex items-center gap-3 max-w-sm ${
        type === 'error'
          ? 'bg-red-500 text-white'
          : 'bg-green-500 text-white'
      }`}
    >
      {type === 'success' ? (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <p className="font-bold text-sm">
        {type === 'error' ? 'Oops! ' : 'Success! '}
        <span className="font-normal">{message}</span>
      </p>
      <button onClick={onDismiss} className="ml-auto text-white/70 hover:text-white transition-colors flex-shrink-0">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
