'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LogOut } from 'lucide-react';
import { MEMBER_SESSION_EVENT, memberLogout } from '@/lib/api';
import { usePublicClub } from '@/lib/queries';
import { Providers } from '@/components/Providers';
import { MemberLogin } from '@/components/portal/MemberLogin';
import { MemberPanel } from '@/components/portal/MemberPanel';

// Sesión del socio leída de localStorage; se actualiza con el evento de login/logout
function subscribeSession(onChange: () => void) {
  window.addEventListener(MEMBER_SESSION_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(MEMBER_SESSION_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
const hasSession = () => Boolean(localStorage.getItem('memberToken'));
const noopSubscribe = () => () => {};

function Portal() {
  const queryClient = useQueryClient();
  const { data: club } = usePublicClub();
  // null en el prerender del export estático (evita errores de hidratación)
  const logged = useSyncExternalStore(subscribeSession, hasSession, () => null);
  const search = useSyncExternalStore(noopSubscribe, () => window.location.search, () => '');
  const [statusDismissed, setStatusDismissed] = useState(false);
  const paymentStatus = statusDismissed ? null : new URLSearchParams(search).get('status');

  useEffect(() => {
    if (club?.primaryColor) document.documentElement.style.setProperty('--color-primary', club.primaryColor);
    if (club?.secondaryColor) document.documentElement.style.setProperty('--color-secondary', club.secondaryColor);
  }, [club?.primaryColor, club?.secondaryColor]);

  // PWA: el portal se puede instalar y abre el carnet aunque la señal sea mala
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/socio/' }).catch(() => {});
    }
  }, []);

  // Al salir o vencer la sesión no quedan datos del socio en memoria
  useEffect(() => {
    if (logged === false) queryClient.removeQueries({ queryKey: ['member'] });
  }, [logged, queryClient]);

  const dismissStatus = () => {
    setStatusDismissed(true);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const clubInfo = { name: club?.name ?? 'Club', logoUrl: club?.logoUrl, onlinePayments: club?.onlinePayments };

  return (
    <main className="min-h-screen bg-[#05070e] text-white">
      <header className="border-b border-white/6 bg-[#05070e]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3">
            {club?.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={club.logoUrl} alt="" className="h-9 w-9 object-contain" />
            )}
            <span className="font-display text-[15px] font-semibold">{clubInfo.name}</span>
          </Link>
          <nav className="flex items-center gap-4 text-[13px]" aria-label="Portal">
            <Link href="/" className="hidden items-center gap-1 text-white/60 transition-colors hover:text-white sm:inline-flex">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Volver al sitio
            </Link>
            {logged && (
              <button
                onClick={memberLogout}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-4 py-1.5 font-semibold text-white/70 transition-colors hover:border-white/40 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Salir
              </button>
            )}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-12">
        {logged === null ? null : logged ? (
          <MemberPanel club={clubInfo} paymentStatus={paymentStatus} onDismissStatus={dismissStatus} />
        ) : (
          <MemberLogin />
        )}
      </div>
    </main>
  );
}

export default function SocioPage() {
  return (
    <Providers>
      <Portal />
    </Providers>
  );
}
