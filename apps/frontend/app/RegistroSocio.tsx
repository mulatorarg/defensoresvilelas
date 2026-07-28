'use client';

import { useMemo, useState } from 'react';
import { registerPublicMember } from '../lib/api';

interface Category {
  id: string;
  name: string;
  ageFrom?: number | null;
  ageTo?: number | null;
}

interface Discipline {
  id: string;
  name: string;
  icon?: string | null;
  categories: Category[];
}

interface Props {
  disciplines: Discipline[];
  monthlyFee?: string | null;
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-primary/60 focus:bg-white/[0.08]';

const formatMoney = (value: number) =>
  value.toLocaleString('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

export default function RegistroSocio({ disciplines, monthlyFee }: Props) {
  const [step, setStep] = useState<'form' | 'paying' | 'done'>('form');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    member: { memberNumber: string; firstName: string };
    fee: { amount: string; period: string };
  } | null>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    dni: '',
    birthDate: '',
    email: '',
    phone: '',
    categoryId: '',
  });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const amount = useMemo(() => {
    return Number(monthlyFee ?? 0);
  }, [monthlyFee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStep('paying');

    // Simulación de checkout (Mercado Pago se integra más adelante)
    await new Promise((r) => setTimeout(r, 1800));

    try {
      const data = await registerPublicMember({
        firstName: form.firstName,
        lastName: form.lastName,
        dni: form.dni,
        birthDate: form.birthDate,
        email: form.email || undefined,
        phone: form.phone || undefined,
        categoryId: form.categoryId || undefined,
      });
      setResult(data);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos completar el registro.');
      setStep('form');
    }
  };

  if (step === 'done' && result) {
    return (
      <div className="rounded-3xl border border-primary/30 bg-white/[0.03] p-8 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-3xl">
          🎉
        </div>
        <h3 className="font-display text-2xl font-bold">
          ¡Bienvenido al club, {result.member.firstName}!
        </h3>
        <p className="mt-3 text-sm text-white/60">Tu número de socio es</p>
        <p
          className="font-display text-4xl font-black tracking-widest"
          style={{ color: 'var(--color-primary)' }}
        >
          {result.member.memberNumber}
        </p>
        <p className="mx-auto mt-5 max-w-sm text-[13px] leading-relaxed text-white/50">
          Tu cuota {result.fee.period} ya está paga ✔. Ingresá al{' '}
          <a href="/socio/" className="font-semibold text-primary hover:underline">
            portal del socio
          </a>{' '}
          con tu DNI y fecha de nacimiento para ver tu carnet digital con QR.
        </p>
        <a
          href="/socio/"
          className="mt-7 inline-block rounded-full px-8 py-3 text-sm font-bold text-white shadow-[0_12px_45px_-10px_var(--color-primary)] transition-transform hover:scale-[1.04]"
          style={{
            backgroundImage:
              'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
          }}
        >
          Ir a mi carnet
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative rounded-3xl border border-white/[0.08] bg-white/[0.03] p-7"
    >
      <h3 className="font-display text-xl font-bold">Asociate ahora</h3>
      <p className="mt-1 text-[13px] text-white/45">
        Completá tus datos y pagá tu primera cuota online.
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[13px] text-red-300">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <input required placeholder="Nombre" value={form.firstName} onChange={set('firstName')} className={inputClass} />
        <input required placeholder="Apellido" value={form.lastName} onChange={set('lastName')} className={inputClass} />
        <input required placeholder="DNI" value={form.dni} onChange={set('dni')} className={inputClass} inputMode="numeric" />
        <div>
          <input
            required
            type="date"
            value={form.birthDate}
            onChange={set('birthDate')}
            className={inputClass + ' [color-scheme:dark]'}
            aria-label="Fecha de nacimiento"
          />
          <p className="mt-1 pl-1 text-[10px] uppercase tracking-wider text-white/30">
            Fecha de nacimiento
          </p>
        </div>
        <input type="email" placeholder="Email (opcional)" value={form.email} onChange={set('email')} className={inputClass} />
        <input placeholder="Teléfono (opcional)" value={form.phone} onChange={set('phone')} className={inputClass} />
      </div>

      <select
        value={form.categoryId}
        onChange={set('categoryId')}
        className={inputClass + ' mt-3 [color-scheme:dark]'}
      >
        <option value="">Solo cuota social (sin disciplina)</option>
        {disciplines.map((d) => (
          <optgroup key={d.id} label={`${d.icon ?? ''} ${d.name}`.trim()}>
            {d.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {d.name} — {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/[0.08] bg-black/25 px-5 py-3.5">
        <span className="text-[13px] text-white/50">Cuota mensual</span>
        <span className="font-display text-xl font-bold">
          {amount > 0 ? formatMoney(amount) : '—'}
        </span>
      </div>

      <button
        type="submit"
        disabled={step === 'paying'}
        className="mt-5 w-full rounded-full py-3.5 text-sm font-bold text-white shadow-[0_12px_45px_-10px_var(--color-primary)] transition-all hover:scale-[1.02] disabled:cursor-wait disabled:opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
        }}
      >
        {step === 'paying' ? 'Procesando pago…' : 'Pagar cuota y asociarme'}
      </button>
      <p className="mt-3 text-center text-[11px] text-white/30">
        Pago de demostración — próximamente Mercado Pago.
      </p>
    </form>
  );
}
