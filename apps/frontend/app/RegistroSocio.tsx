'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PartyPopper } from 'lucide-react';
import { registerPublicMember } from '../lib/api';
import { errorText } from '../lib/queries';
import { formatMoney, toNumber } from '../lib/money';
import { DarkField } from '../components/portal/DarkField';

interface Category {
  id: string;
  name: string;
  ageFrom?: number | null;
  ageTo?: number | null;
  feeAmount?: string | null;
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
  /** Clave pública de Cloudflare Turnstile; sin ella no hay captcha. */
  turnstileSiteKey?: string | null;
}

interface Turnstile {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const schema = z.object({
  firstName: z.string().trim().min(1, 'Ingresá tu nombre'),
  lastName: z.string().trim().min(1, 'Ingresá tu apellido'),
  dni: z.string().trim().regex(/^\d{6,9}$/, 'Solo números, sin puntos'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elegí tu fecha de nacimiento'),
  email: z.string().trim().refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Email inválido'),
  phone: z.string().trim(),
  categoryId: z.string(),
  // Honeypot anti-bots: el input está oculto, una persona nunca lo completa
  website: z.string(),
});
type Values = z.infer<typeof schema>;

const gradientBg = { backgroundImage: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' };

/** Widget de Cloudflare Turnstile (se carga solo si el club lo configuró). */
function Captcha({ siteKey, onToken }: { siteKey: string; onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let widgetId: string | undefined;
    const render = () => {
      if (!container.current || !window.turnstile) return;
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        theme: 'dark',
        language: 'es',
        callback: onToken,
        'expired-callback': () => onToken(''),
      });
    };
    if (window.turnstile) render();
    else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }
    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, onToken]);
  return <div ref={container} className="min-h-[65px]" />;
}

export default function RegistroSocio({ disciplines, monthlyFee, turnstileSiteKey }: Props) {
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [result, setResult] = useState<{
    member: { memberNumber: string; firstName: string };
    fee: { amount: string; period: string };
  } | null>(null);
  const onCaptcha = useCallback((token: string) => setCaptchaToken(token), []);

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', dni: '', birthDate: '', email: '', phone: '', categoryId: '', website: '' },
  });

  // Mismo criterio que el backend: cuota de la categoría si tiene, si no la cuota social
  const categoryId = useWatch({ control, name: 'categoryId' });
  const category = disciplines.flatMap((d) => d.categories).find((c) => c.id === categoryId);
  const amount = toNumber(category?.feeAmount || monthlyFee);

  const submit = handleSubmit(async (v) => {
    setError('');
    if (turnstileSiteKey && !captchaToken) {
      setError('Completá la verificación de seguridad.');
      return;
    }
    try {
      const data = await registerPublicMember({
        firstName: v.firstName,
        lastName: v.lastName,
        dni: v.dni,
        birthDate: v.birthDate,
        email: v.email || undefined,
        phone: v.phone || undefined,
        categoryId: v.categoryId || undefined,
        website: v.website || undefined,
        captchaToken: captchaToken || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(errorText(err, 'No pudimos completar el registro.'));
      if (turnstileSiteKey) window.turnstile?.reset(); // el token es de un solo uso
      setCaptchaToken('');
    }
  });

  if (result) {
    return (
      <div className="rounded-3xl border border-primary/30 bg-white/3 p-8 text-center" role="status">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <PartyPopper className="h-8 w-8" aria-hidden />
        </div>
        <h3 className="font-display text-2xl font-bold">¡Bienvenido al club, {result.member.firstName}!</h3>
        <p className="mt-3 text-sm text-white/60">Tu número de socio es</p>
        <p className="font-display text-4xl font-black tracking-widest" style={{ color: 'var(--color-primary)' }}>
          {result.member.memberNumber}
        </p>
        <p className="mx-auto mt-5 max-w-sm text-[13px] leading-relaxed text-white/60">
          Tu cuota {result.fee.period} quedó pendiente de pago: podés abonarla en secretaría. Ingresá al{' '}
          <a href="/socio/" className="font-semibold text-primary hover:underline">
            portal del socio
          </a>{' '}
          con tu DNI y fecha de nacimiento, y creá tu PIN para ver tu carnet digital con QR.
        </p>
        <a
          href="/socio/"
          className="mt-7 inline-block rounded-full px-8 py-3 text-sm font-bold text-white shadow-[0_12px_45px_-10px_var(--color-primary)] transition-transform hover:scale-[1.04]"
          style={gradientBg}
        >
          Ir a mi carnet
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="relative rounded-3xl border border-white/8 bg-white/3 p-7" noValidate>
      <h3 className="font-display text-xl font-bold">Asociate ahora</h3>
      <p className="mt-1 text-[13px] text-white/50">Completá tus datos y abonás la primera cuota en secretaría.</p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[13px] text-red-300">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <DarkField label="Nombre" autoComplete="given-name" {...register('firstName')} error={errors.firstName?.message} />
        <DarkField label="Apellido" autoComplete="family-name" {...register('lastName')} error={errors.lastName?.message} />
        <DarkField label="DNI" inputMode="numeric" {...register('dni')} error={errors.dni?.message} />
        <DarkField
          label="Fecha de nacimiento"
          type="date"
          className="[color-scheme:dark]"
          autoComplete="bday"
          {...register('birthDate')}
          error={errors.birthDate?.message}
        />
        <DarkField label="Email (opcional)" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
        <DarkField label="Teléfono (opcional)" type="tel" autoComplete="tel" {...register('phone')} />
      </div>

      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
        {...register('website')}
      />

      <label className="mt-3 block">
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/50">Actividad</span>
        <select
          {...register('categoryId')}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-hidden [color-scheme:dark] focus:border-primary/60"
        >
          <option value="">Solo cuota social (sin disciplina)</option>
          {disciplines.map((d) => (
            <optgroup key={d.id} label={`${d.icon ?? ''} ${d.name}`.trim()}>
              {d.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {d.name} - {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div className="mt-5 flex items-center justify-between rounded-2xl border border-white/8 bg-black/25 px-5 py-3.5">
        <span className="text-[13px] text-white/60">Cuota mensual</span>
        <span className="font-display text-xl font-bold">{amount > 0 ? formatMoney(amount, { decimals: 0 }) : '-'}</span>
      </div>

      {turnstileSiteKey && (
        <div className="mt-4">
          <Captcha siteKey={turnstileSiteKey} onToken={onCaptcha} />
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-5 w-full rounded-full py-3.5 text-sm font-bold text-white shadow-[0_12px_45px_-10px_var(--color-primary)] transition-all hover:scale-[1.02] disabled:cursor-wait disabled:opacity-70"
        style={gradientBg}
      >
        {isSubmitting ? 'Enviando…' : 'Asociarme'}
      </button>
    </form>
  );
}
