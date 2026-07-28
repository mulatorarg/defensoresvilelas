'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  getMemberCard,
  getMemberFees,
  getMemberInfo,
  getMemberProfile,
  getPublicClub,
  memberLogin,
  memberLogout,
} from '../../lib/api';

interface ClubInfo {
  name: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

interface Fee {
  id: string;
  period: string;
  amount: string;
  paidAmount: string;
  status: string;
  feeType?: { name: string } | null;
  category?: { name: string; discipline?: { name: string } } | null;
}

interface Profile {
  memberNumber?: string | null;
  firstName: string;
  lastName: string;
  dni: string;
  enrollments: {
    id: string;
    category: { name: string; schedule?: string | null; discipline: { name: string } };
  }[];
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-primary/60 focus:bg-white/[0.08]';

const formatMoney = (value: string | number) =>
  Number(value).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

const gradientBg = {
  backgroundImage: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
};

export default function SocioPage() {
  const [club, setClub] = useState<ClubInfo>({ name: 'Club' });
  const [logged, setLogged] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fees, setFees] = useState<Fee[]>([]);
  const [qr, setQr] = useState<string>('');
  const [dni, setDni] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPublicClub()
      .then((c: ClubInfo & { primaryColor?: string; secondaryColor?: string }) => {
        setClub(c);
        if (c.primaryColor)
          document.documentElement.style.setProperty('--color-primary', c.primaryColor);
        if (c.secondaryColor)
          document.documentElement.style.setProperty('--color-secondary', c.secondaryColor);
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    const [profileData, feesData, cardData] = await Promise.all([
      getMemberProfile(),
      getMemberFees(),
      getMemberCard(),
    ]);
    setProfile(profileData);
    setFees(feesData);
    setQr(await QRCode.toDataURL(cardData.qrPayload, { width: 260, margin: 1 }));
    setLogged(true);
  }, []);

  useEffect(() => {
    if (getMemberInfo()) {
      loadData().catch(() => memberLogout());
    }
  }, [loadData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await memberLogin(dni, birthDate);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error && err.message !== 'SESSION_EXPIRED'
          ? err.message
          : 'No pudimos iniciar sesión.',
      );
    } finally {
      setLoading(false);
    }
  };

  const refreshQr = async () => {
    const cardData = await getMemberCard();
    setQr(await QRCode.toDataURL(cardData.qrPayload, { width: 260, margin: 1 }));
  };

  const handleLogout = () => {
    memberLogout();
    setLogged(false);
    setProfile(null);
    setFees([]);
    setQr('');
  };

  return (
    <main className="min-h-screen bg-[#05070e] text-white">
      {/* Header */}
      <header className="border-b border-white/[0.06] bg-[#05070e]/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3">
            {club.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={club.logoUrl} alt="" className="h-9 w-9 object-contain" />
            )}
            <span className="font-display text-[15px] font-semibold">{club.name}</span>
          </Link>
          <div className="flex items-center gap-4 text-[13px]">
            <Link href="/" className="text-white/50 transition-colors hover:text-white">
              ← Volver al sitio
            </Link>
            {logged && (
              <button
                onClick={handleLogout}
                className="rounded-full border border-white/15 px-4 py-1.5 font-semibold text-white/70 transition-colors hover:border-white/40 hover:text-white"
              >
                Salir
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-12">
        {!logged ? (
          /* ===== Login ===== */
          <div className="mx-auto max-w-md">
            <div className="mb-8 text-center">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/40">
                Portal del socio
              </p>
              <h1 className="font-display text-3xl font-bold">Tu club, en tu bolsillo</h1>
              <p className="mt-2 text-sm text-white/50">
                Ingresá con tu DNI y fecha de nacimiento.
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-7"
            >
              {error && (
                <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[13px] text-red-300">
                  {error}
                </p>
              )}
              <div className="space-y-3">
                <input
                  required
                  placeholder="DNI"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className={inputClass}
                  inputMode="numeric"
                />
                <div>
                  <input
                    required
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className={inputClass + ' [color-scheme:dark]'}
                  />
                  <p className="mt-1 pl-1 text-[10px] uppercase tracking-wider text-white/30">
                    Fecha de nacimiento
                  </p>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-5 w-full rounded-full py-3.5 text-sm font-bold text-white shadow-[0_12px_45px_-10px_var(--color-primary)] transition-all hover:scale-[1.02] disabled:opacity-70"
                style={gradientBg}
              >
                {loading ? 'Ingresando…' : 'Ingresar'}
              </button>
              <p className="mt-4 text-center text-[12px] text-white/35">
                ¿Todavía no sos socio?{' '}
                <Link href="/#asociate" className="font-semibold text-primary hover:underline">
                  Asociate online
                </Link>
              </p>
            </form>
          </div>
        ) : (
          /* ===== Panel del socio ===== */
          <div className="grid gap-6 md:grid-cols-5">
            {/* Carnet */}
            <div className="md:col-span-2">
              <div
                className="overflow-hidden rounded-3xl p-[1px]"
                style={{
                  backgroundImage:
                    'linear-gradient(140deg, var(--color-primary), rgba(255,255,255,0.12), var(--color-secondary))',
                }}
              >
                <div className="rounded-[calc(1.5rem-1px)] bg-[#0a1410] p-6 text-center">
                  <div className="mb-4 flex items-center justify-center gap-2.5">
                    {club.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={club.logoUrl} alt="" className="h-8 w-8 object-contain" />
                    )}
                    <p className="font-display text-[13px] font-bold">{club.name}</p>
                  </div>
                  {qr && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qr}
                      alt="Carnet QR"
                      className="mx-auto rounded-2xl bg-white p-2"
                      width={220}
                      height={220}
                    />
                  )}
                  <p className="mt-4 font-display text-lg font-bold">
                    {profile?.firstName} {profile?.lastName}
                  </p>
                  <p className="text-[13px] text-white/50">DNI {profile?.dni}</p>
                  <p
                    className="mt-1 font-display text-2xl font-black tracking-[0.2em]"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {profile?.memberNumber}
                  </p>
                  <button
                    onClick={refreshQr}
                    className="mt-4 rounded-full border border-white/15 px-5 py-2 text-[12px] font-semibold text-white/60 transition-colors hover:border-white/40 hover:text-white"
                  >
                    ↻ Actualizar QR
                  </button>
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-white/25">
                    El código vence a los 5 minutos
                  </p>
                </div>
              </div>
            </div>

            {/* Cuotas + actividades */}
            <div className="space-y-6 md:col-span-3">
              <section className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6">
                <h2 className="font-display text-lg font-bold">Mis cuotas pendientes</h2>
                {fees.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-[13px] text-white/70">
                    ✔ Estás al día. ¡Gracias por bancar al club!
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {fees.map((fee) => {
                      const pending = Number(fee.amount) - Number(fee.paidAmount);
                      return (
                        <li
                          key={fee.id}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-black/25 px-5 py-3.5"
                        >
                          <div>
                            <p className="text-sm font-semibold">
                              {fee.feeType?.name ?? 'Cuota'} · {fee.period}
                            </p>
                            <p className="text-[12px] text-white/40">
                              {fee.category
                                ? `${fee.category.discipline?.name ?? ''} ${fee.category.name}`
                                : 'Cuota social'}
                              {fee.status === 'PARTIALLY_PAID' &&
                                ` · pagado ${formatMoney(fee.paidAmount)}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-display text-lg font-bold">
                              {formatMoney(pending)}
                            </p>
                            <p className="text-[11px] uppercase tracking-wide text-amber-400/80">
                              {fee.status === 'PARTIALLY_PAID' ? 'Parcial' : 'Pendiente'}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-4 text-[11px] text-white/30">
                  Próximamente vas a poder pagar desde acá con Mercado Pago. Por ahora,
                  acercate a secretaría.
                </p>
              </section>

              <section className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6">
                <h2 className="font-display text-lg font-bold">Mis actividades</h2>
                {profile?.enrollments?.length ? (
                  <ul className="mt-4 space-y-3">
                    {profile.enrollments.map((e) => (
                      <li
                        key={e.id}
                        className="rounded-2xl border border-white/[0.07] bg-black/25 px-5 py-3.5"
                      >
                        <p className="text-sm font-semibold">
                          {e.category.discipline.name} · {e.category.name}
                        </p>
                        {e.category.schedule && (
                          <p className="text-[12px] text-white/40">{e.category.schedule}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[13px] text-white/45">
                    No estás inscripto en ninguna disciplina. Consultá en secretaría para sumarte.
                  </p>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
