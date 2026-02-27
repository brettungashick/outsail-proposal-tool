'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';

export default function Navbar() {
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string })?.role;

  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">
              OutSail
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
            >
              Projects
            </Link>
            <Link
              href="/benchmarks"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
            >
              Benchmarks
            </Link>
            {userRole === 'admin' && (
              <Link
                href="/settings/vendors"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition"
              >
                Settings
              </Link>
            )}
          </div>

          <div className="flex items-center gap-4">
            {session?.user && (
              <>
                <span className="text-sm text-slate-500">{session.user.email}</span>
                {userRole === 'admin' && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Admin</span>
                )}
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
