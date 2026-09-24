'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  CalendarCheck,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  Newspaper,
  ScrollText,
  Settings,
  Trophy,
  UserCog,
  Users,
  X,
  type LucideProps,
} from 'lucide-react';
import { clearSession, useStoredUser } from '@/lib/auth';
import { usePublicClub } from '@/lib/queries';
import AuthGuard from '@/components/AuthGuard';
import { Providers } from '@/components/Providers';
import { AccountModal } from '@/components/account/AccountModal';
import { FeedbackProvider } from '@/components/ui/Feedback';

// Roles que ven cada sección (el backend valida igual cada endpoint)
const MANAGERS = ['ADMIN', 'OPERATOR'];
const NAV_ITEMS: {
  href: string;
  label: string;
  icon: ComponentType<LucideProps>;
  roles?: string[];
}[] = [
  { href: '/admin/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/socios/', label: 'Socios', icon: Users },
  { href: '/admin/disciplinas/', label: 'Disciplinas', icon: Trophy },
  { href: '/admin/cuotas/', label: 'Cuotas', icon: CreditCard, roles: MANAGERS },
  { href: '/admin/morosidad/', label: 'Morosidad', icon: AlertTriangle, roles: MANAGERS },
  { href: '/admin/asistencias/', label: 'Asistencia', icon: CalendarCheck },
  { href: '/admin/caja/', label: 'Caja', icon: Banknote, roles: MANAGERS },
  { href: '/admin/reportes/', label: 'Reportes', icon: BarChart3, roles: MANAGERS },
  { href: '/admin/noticias/', label: 'Noticias y eventos', icon: Newspaper, roles: MANAGERS },
  { href: '/admin/usuarios/', label: 'Usuarios', icon: UserCog, roles: ['ADMIN'] },
  { href: '/admin/auditoria/', label: 'Auditoría', icon: ScrollText, roles: ['ADMIN'] },
  { href: '/admin/configuracion/', label: 'Configuración', icon: Settings, roles: ['ADMIN'] },
];

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const user = useStoredUser();
  const { data: club } = usePublicClub();
  const clubName = club?.name ?? 'Mi Club';
  const navItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

  useEffect(() => {
    if (club?.primaryColor) document.documentElement.style.setProperty('--color-primary', club.primaryColor);
    if (club?.secondaryColor) document.documentElement.style.setProperty('--color-secondary', club.secondaryColor);
  }, [club?.primaryColor, club?.secondaryColor]);

  const handleLogout = () => {
    clearSession();
    queryClient.clear(); // que el próximo usuario no vea datos cacheados del anterior
    router.push('/login/');
  };

  const isActive = (href: string) =>
    href === '/admin/' ? pathname === '/admin' || pathname === '/admin/' : pathname.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0a1410] text-white">
      {/* Club */}
      <div className="flex items-center gap-3 border-b border-white/6 px-5 py-5">
        {club?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={club.logoUrl} alt="" className="h-10 w-10 object-contain" />
        ) : (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-display text-sm font-bold">
            {clubName.charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-display text-[13px] font-bold leading-tight">{clubName}</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">Administración</p>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Secciones" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              aria-current={active ? 'page' : undefined}
              className={
                'group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-colors ' +
                (active ? 'bg-white/7 text-white' : 'text-white/50 hover:bg-white/4 hover:text-white')
              }
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full"
                  style={{ background: 'var(--color-primary)' }}
                />
              )}
              <Icon
                aria-hidden
                className={'h-[18px] w-[18px] ' + (active ? 'text-primary' : 'text-white/40 group-hover:text-white/70')}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Usuario */}
      <div className="border-t border-white/6 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/4 p-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-white"
            style={{ backgroundImage: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}
            aria-hidden
          >
            {(user?.firstName?.[0] ?? 'U') + (user?.lastName?.[0] ?? '')}
          </span>
          <button
            onClick={() => {
              setMenuOpen(false);
              setAccountOpen(true);
            }}
            title="Mi cuenta"
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-[13px] font-semibold leading-tight">
              {user ? user.firstName + ' ' + user.lastName : 'Usuario'}
            </p>
            <p className="truncate text-[11px] text-white/40">{user?.role ?? ''} · Mi cuenta</p>
          </button>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="text-white/40 transition-colors hover:text-red-400"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f4f6f5]">
      {/* Sidebar desktop */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-64 lg:block print:hidden">{sidebar}</aside>

      {/* Topbar mobile */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between bg-[#0a1410] px-4 text-white lg:hidden print:hidden">
        <div className="flex items-center gap-2.5">
          {club?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.logoUrl} alt="" className="h-8 w-8 object-contain" />
          )}
          <span className="font-display text-sm font-bold">{clubName}</span>
        </div>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="p-2"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
        </button>
      </header>
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="absolute left-0 top-0 h-full w-64" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="px-4 pb-12 pt-20 sm:px-5 lg:ml-64 lg:px-10 lg:pt-8 print:m-0 print:p-0">{children}</main>
      <AccountModal isOpen={accountOpen} onClose={() => setAccountOpen(false)} />
    </div>
  );
}

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthGuard>
      <Providers>
        <FeedbackProvider>
          <AdminShell>{children}</AdminShell>
        </FeedbackProvider>
      </Providers>
    </AuthGuard>
  );
}
