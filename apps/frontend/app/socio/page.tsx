'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  changeMemberPin,
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
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-hidden transition-colors focus:border-primary/60 focus:bg-white/8';

const formatMoney = (value: string | number) =>
  Number(value).toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

const PIN_PATTERN = '[0-9]{4,6}';

const onlyDigits = (value: string) => value.replace(/[^0-9]/g, '');

const PIN_FIELDS = [
  ['current', 'PIN actual', 'current-password'],
  ['next', 'PIN nuevo (4 a 6 números)', 'new-password'],
  ['confirm', 'Repetí el PIN nuevo', 'new-password'],
] as const;

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
  const [pin, setPin] = useState('');
  // Primer ingreso: el socio todavía no tiene PIN y tiene que crear uno
  const [settingPin, setSettingPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pinPanel, setPinPanel] = useState(false);
  const [pinForm, setPinForm] = useState({ current: '', next: '', confirm: '' });
  const [pinMessage, setPinMessage] = useState<{ ok: boolean; text: string } | null>(null);

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
    if (settingPin && newPin !== newPinConfirm) {
      setError('Los PIN no coinciden.');
      return;
    }
    setLoading(true);
    try {
      const result = await memberLogin(
        settingPin ? { dni, birthDate, newPin } : { dni, birthDate, pin: pin || undefined },
      );
      if (result.pinSetupRequired) {
        setSettingPin(true);
        return;
      }
      setSettingPin(false);
      setPin('');
      setNewPin('');
      setNewPinConfirm('');
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

  const refreshQr = useCallback(async () => {
    try {
      const cardData = await getMemberCard();
      setQr(await QRCode.toDataURL(cardData.qrPayload, { width: 260, margin: 1 }));
    } catch (err) {
      if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
        setLogged(false);
        setProfile(null);
        setFees([]);
        setQr('');
      }
    }
  }, []);

  // El QR vence a los 5 minutos: se renueva solo cada 4 para que el carnet
  // mostrado en la puerta siempre sea válido
  useEffect(() => {
    if (!logged) return;
    const id = setInterval(refreshQr, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, [logged, refreshQr]);

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);
    if (pinForm.next !== pinForm.confirm) {
      setPinMessage({ ok: false, text: 'Los PIN nuevos no coinciden.' });
      return;
    }
    try {
      await changeMemberPin(pinForm.current, pinForm.next);
      setPinForm({ current: '', next: '', confirm: '' });
      setPinMessage({ ok: true, text: 'PIN actualizado. Se cerraron tus otras sesiones.' });
    } catch (err) {
      setPinMessage({
        ok: false,
        text: err instanceof Error ? err.message : 'No pudimos cambiar el PIN.',
      });
    }
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
      <header className="border-b border-white/6 bg-[#05070e]/80 backdrop-blur">
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
                {settingPin
                  ? 'Es tu primer ingreso: creá un PIN de 4 a 6 números para proteger tu cuenta.'
                  : 'Ingresá con tu DNI, fecha de nacimiento y PIN.'}
              </p>
            </div>

            <form
              onSubmit={handleLogin}
              className="rounded-3xl border border-white/8 bg-white/3 p-7"
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
                  aria-label="DNI"
                  value={dni}
                  onChange={(e) => setDni(e.target.value)}
                  className={inputClass}
                  inputMode="numeric"
                  disabled={settingPin}
                />
                <div>
                  <input
                    required
                    type="date"
                    aria-label="Fecha de nacimiento"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className={inputClass + ' [color-scheme:dark]'}
                    disabled={settingPin}
                  />
                  <p className="mt-1 pl-1 text-[10px] uppercase tracking-wider text-white/30">
                    Fecha de nacimiento
                  </p>
                </div>
                {settingPin ? (
                  <>
                    <input
                      required
                      type="password"
                      placeholder="Nuevo PIN (4 a 6 números)"
                      aria-label="Nuevo PIN"
                      value={newPin}
                      onChange={(e) => setNewPin(onlyDigits(e.target.value))}
                      className={inputClass}
                      inputMode="numeric"
                      autoComplete="new-password"
                      pattern={PIN_PATTERN}
                      maxLength={6}
                      autoFocus
                    />
                    <input
                      required
                      type="password"
                      placeholder="Repetí el PIN"
                      aria-label="Repetir PIN"
                      value={newPinConfirm}
                      onChange={(e) => setNewPinConfirm(onlyDigits(e.target.value))}
                      className={inputClass}
                      inputMode="numeric"
                      autoComplete="new-password"
                      pattern={PIN_PATTERN}
                      maxLength={6}
                    />
                  </>
                ) : (
                  <input
                    type="password"
                    placeholder="PIN (si ya creaste uno)"
                    aria-label="PIN"
                    value={pin}
                    onChange={(e) => setPin(onlyDigits(e.target.value))}
                    className={inputClass}
                    inputMode="numeric"
                    autoComplete="current-password"
                    maxLength={6}
                  />
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-5 w-full rounded-full py-3.5 text-sm font-bold text-white shadow-[0_12px_45px_-10px_var(--color-primary)] transition-all hover:scale-[1.02] disabled:opacity-70"
                style={gradientBg}
              >
                {loading ? 'Ingresando…' : settingPin ? 'Crear PIN e ingresar' : 'Ingresar'}
              </button>
              {settingPin && (
                <button
                  type="button"
                  onClick={() => {
                    setSettingPin(false);
                    setNewPin('');
                    setNewPinConfirm('');
                    setError('');
                  }}
                  className="mt-3 w-full text-center text-[12px] text-white/40 hover:text-white"
                >
                  Volver
                </button>
              )}
              <p className="mt-4 text-center text-[12px] text-white/35">
                ¿Olvidaste tu PIN? Pedí en secretaría que lo blanqueen.
              </p>
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
                className="overflow-hidden rounded-3xl p-px"
                style={{
                  backgroundImage:
                    'linear-gradient(140deg, var(--color-primary), rgba(255,255,255,0.12), var(--color-secondary))',
                }}
              >
                <div className="rounded-[calc(var(--radius-3xl)-1px)] bg-[#0a1410] p-6 text-center">
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
                    Se renueva automáticamente
                  </p>
                </div>
              </div>
            </div>

            {/* Cuotas + actividades */}
            <div className="space-y-6 md:col-span-3">
              <section className="rounded-3xl border border-white/8 bg-white/3 p-6">
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
                          className="flex items-center justify-between gap-4 rounded-2xl border border-white/7 bg-black/25 px-5 py-3.5"
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

              <section className="rounded-3xl border border-white/8 bg-white/3 p-6">
                <h2 className="font-display text-lg font-bold">Mis actividades</h2>
                {profile?.enrollments?.length ? (
                  <ul className="mt-4 space-y-3">
                    {profile.enrollments.map((e) => (
                      <li
                        key={e.id}
                        className="rounded-2xl border border-white/7 bg-black/25 px-5 py-3.5"
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

              <section className="rounded-3xl border border-white/8 bg-white/3 p-6">
                <button
                  onClick={() => {
                    setPinPanel((v) => !v);
                    setPinMessage(null);
                  }}
                  className="flex w-full items-center justify-between text-left"
                  aria-expanded={pinPanel}
                >
                  <h2 className="font-display text-lg font-bold">Cambiar PIN</h2>
                  <span className="text-[12px] text-white/40">{pinPanel ? 'Cerrar' : 'Abrir'}</span>
                </button>
                {pinPanel && (
                  <form onSubmit={handleChangePin} className="mt-4 space-y-3">
                    {pinMessage && (
                      <p
                        className={`rounded-xl border px-4 py-2.5 text-[13px] ${
                          pinMessage.ok
                            ? 'border-primary/30 bg-primary/10 text-white/80'
                            : 'border-red-500/30 bg-red-500/10 text-red-300'
                        }`}
                      >
                        {pinMessage.text}
                      </p>
                    )}
                    {PIN_FIELDS.map(([key, label, autoComplete]) => (
                      <input
                        key={key}
                        required
                        type="password"
                        placeholder={label}
                        aria-label={label}
                        value={pinForm[key]}
                        onChange={(e) =>
                          setPinForm((f) => ({ ...f, [key]: onlyDigits(e.target.value) }))
                        }
                        className={inputClass}
                        inputMode="numeric"
                        autoComplete={autoComplete}
                        pattern={key === 'current' ? undefined : PIN_PATTERN}
                        maxLength={6}
                      />
                    ))}
                    <button
                      type="submit"
                      className="w-full rounded-full border border-white/15 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/40 hover:text-white"
                    >
                      Guardar PIN
                    </button>
                  </form>
                )}
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
