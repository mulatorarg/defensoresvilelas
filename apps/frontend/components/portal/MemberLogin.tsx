'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { memberLogin } from '@/lib/api';
import { errorText } from '@/lib/queries';
import { DarkField } from './DarkField';

const digits = (v: string) => v.replace(/[^0-9]/g, '');

const schema = z.object({
  dni: z.string().trim().regex(/^\d{6,9}$/, 'Solo números, sin puntos'),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elegí tu fecha de nacimiento'),
  pin: z.string().refine((v) => v === '' || /^\d{4,6}$/.test(v), 'El PIN tiene de 4 a 6 números'),
  newPin: z.string(),
  newPinConfirm: z.string(),
});
type Values = z.infer<typeof schema>;

const gradientBg = { backgroundImage: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' };

export function MemberLogin() {
  // Primer ingreso: el socio todavía no tiene PIN y tiene que crear uno
  const [settingPin, setSettingPin] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, setValue, setError: setFieldError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { dni: '', birthDate: '', pin: '', newPin: '', newPinConfirm: '' },
  });

  const onlyDigits = (name: 'dni' | 'pin' | 'newPin' | 'newPinConfirm') => {
    const field = register(name);
    return {
      ...field,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        e.target.value = digits(e.target.value);
        return field.onChange(e);
      },
    };
  };

  const submit = handleSubmit(async (v) => {
    setError('');
    if (settingPin) {
      if (!/^\d{4,6}$/.test(v.newPin)) {
        setFieldError('newPin', { message: 'El PIN tiene de 4 a 6 números' });
        return;
      }
      if (v.newPin !== v.newPinConfirm) {
        setFieldError('newPinConfirm', { message: 'Los PIN no coinciden' });
        return;
      }
    }
    try {
      const result = await memberLogin(
        settingPin
          ? { dni: v.dni, birthDate: v.birthDate, newPin: v.newPin }
          : { dni: v.dni, birthDate: v.birthDate, pin: v.pin || undefined },
      );
      if (result.pinSetupRequired) setSettingPin(true);
      // Con sesión, el portal cambia solo al panel (evento de sesión)
    } catch (err) {
      setError(errorText(err, 'No pudimos iniciar sesión.'));
    }
  });

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-8 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-white/40">Portal del socio</p>
        <h1 className="font-display text-3xl font-bold">Tu club, en tu bolsillo</h1>
        <p className="mt-2 text-sm text-white/50">
          {settingPin
            ? 'Es tu primer ingreso: creá un PIN de 4 a 6 números para proteger tu cuenta.'
            : 'Ingresá con tu DNI, fecha de nacimiento y PIN.'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-3xl border border-white/8 bg-white/3 p-7" noValidate>
        {error && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[13px] text-red-300">
            {error}
          </p>
        )}
        <DarkField label="DNI" inputMode="numeric" autoComplete="username" disabled={settingPin} {...onlyDigits('dni')} error={errors.dni?.message} />
        <DarkField
          label="Fecha de nacimiento"
          type="date"
          className="[color-scheme:dark]"
          disabled={settingPin}
          {...register('birthDate')}
          error={errors.birthDate?.message}
        />
        {settingPin ? (
          <>
            <DarkField
              label="PIN nuevo (4 a 6 números)"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              autoFocus
              {...onlyDigits('newPin')}
              error={errors.newPin?.message}
            />
            <DarkField
              label="Repetí el PIN"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              {...onlyDigits('newPinConfirm')}
              error={errors.newPinConfirm?.message}
            />
          </>
        ) : (
          <DarkField
            label="PIN (si ya creaste uno)"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={6}
            {...onlyDigits('pin')}
            error={errors.pin?.message}
          />
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full py-3.5 text-sm font-bold text-white shadow-[0_12px_45px_-10px_var(--color-primary)] transition-all hover:scale-[1.02] disabled:opacity-70"
          style={gradientBg}
        >
          {isSubmitting ? 'Ingresando…' : settingPin ? 'Crear PIN e ingresar' : 'Ingresar'}
        </button>
        {settingPin && (
          <button
            type="button"
            onClick={() => {
              setSettingPin(false);
              setValue('newPin', '');
              setValue('newPinConfirm', '');
              setError('');
            }}
            className="w-full text-center text-[12px] text-white/50 hover:text-white"
          >
            Volver
          </button>
        )}
        <p className="text-center text-[12px] text-white/40">¿Olvidaste tu PIN? Pedí en secretaría que lo blanqueen.</p>
        <p className="text-center text-[12px] text-white/40">
          ¿Todavía no sos socio?{' '}
          <Link href="/#asociate" className="font-semibold text-primary hover:underline">
            Asociate online
          </Link>
        </p>
      </form>
    </div>
  );
}
