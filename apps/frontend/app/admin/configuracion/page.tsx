'use client';

import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getClubConfig, updateClubConfig } from '@/lib/api';
import type { ClubConfig } from '@/lib/types';
import { errorText, qk } from '@/lib/queries';
import { optionalEmail, optionalMoney, optionalText, requiredText } from '@/lib/validation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorState, SkeletonRows } from '@/components/ui/States';
import { useFeedback } from '@/components/ui/Feedback';
import { RoleGuard } from '@/components/common/RoleGuard';
import { ImageUpload } from '@/components/common/ImageUpload';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color inválido');

const schema = z.object({
  name: requiredText('Nombre del club'),
  legalName: optionalText(),
  document: optionalText(),
  logoUrl: z.string(),
  heroImageUrl: z.string(),
  primaryColor: color,
  secondaryColor: color,
  address: optionalText(),
  phone: optionalText(),
  email: optionalEmail,
  whatsapp: optionalText(),
  instagram: optionalText(),
  facebook: optionalText(),
  website: optionalText(),
  monthlyFee: optionalMoney('Cuota social'),
  mpAccessToken: optionalText(500),
  mpWebhookSecret: optionalText(500),
});

type FormValues = z.input<typeof schema>;
type Field = keyof FormValues;

const TEXT_FIELDS: { key: Field; label: string; hint?: string; type?: string }[] = [
  { key: 'name', label: 'Nombre del club' },
  { key: 'legalName', label: 'Razón social', hint: 'Aparece en los recibos' },
  { key: 'document', label: 'CUIT' },
  { key: 'address', label: 'Dirección' },
  { key: 'phone', label: 'Teléfono', type: 'tel' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'whatsapp', label: 'WhatsApp', hint: 'Con código de área, sin 0 ni 15' },
  { key: 'instagram', label: 'Instagram', hint: 'Usuario o link' },
  { key: 'facebook', label: 'Facebook', hint: 'Link a la página' },
  { key: 'website', label: 'Sitio web' },
];

function toForm(config: ClubConfig): FormValues {
  return {
    name: config.name ?? '',
    legalName: config.legalName ?? '',
    document: config.document ?? '',
    logoUrl: config.logoUrl ?? '',
    heroImageUrl: config.heroImageUrl ?? '',
    primaryColor: config.primaryColor ?? '#08a757',
    secondaryColor: config.secondaryColor ?? '#056e3d',
    address: config.address ?? '',
    phone: config.phone ?? '',
    email: config.email ?? '',
    whatsapp: config.whatsapp ?? '',
    instagram: config.instagram ?? '',
    facebook: config.facebook ?? '',
    website: config.website ?? '',
    monthlyFee: config.monthlyFee ?? '',
    mpAccessToken: config.mpAccessToken ?? '',
    mpWebhookSecret: config.mpWebhookSecret ?? '',
  };
}

function ConfigForm({ config }: { config: ClubConfig }) {
  const { toast } = useFeedback();
  const queryClient = useQueryClient();
  const { register, control, handleSubmit, reset, formState: { errors, dirtyFields, isDirty } } = useForm<
    FormValues,
    unknown,
    z.output<typeof schema>
  >({ resolver: zodResolver(schema), defaultValues: toForm(config) });

  const save = useMutation({
    mutationFn: updateClubConfig,
    onSuccess: (saved: ClubConfig) => {
      reset(toForm(saved));
      queryClient.setQueryData(qk.clubConfig, saved);
      queryClient.invalidateQueries({ queryKey: qk.club }); // nombre, logo y colores del menú
      toast('Configuración guardada');
    },
    onError: (err) => toast(errorText(err, 'Error al guardar'), 'error'),
  });

  const submit = handleSubmit((values) => {
    // Solo los campos modificados. Las credenciales de MP llegan enmascaradas:
    // si no se tocaron, no se envían y la API conserva las guardadas.
    const changes: Record<string, unknown> = {};
    (Object.keys(dirtyFields) as Field[]).forEach((key) => {
      const value = values[key];
      changes[key] = typeof value === 'string' ? value.trim() || null : value;
    });
    if (Object.keys(changes).length === 0) {
      toast('No hay cambios para guardar');
      return;
    }
    save.mutate(changes);
  });

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <section className="rounded-2xl border border-gray-100 bg-white p-6" aria-labelledby="cfg-identidad">
        <h2 id="cfg-identidad" className="font-display text-lg font-bold text-gray-900">
          Identidad
        </h2>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <Controller
            control={control}
            name="logoUrl"
            render={({ field }) => (
              <ImageUpload
                label="Escudo o logo"
                folder="club"
                maxSize={1024}
                value={field.value}
                onChange={field.onChange}
                hint="PNG con fondo transparente, idealmente cuadrado"
              />
            )}
          />
          <Controller
            control={control}
            name="heroImageUrl"
            render={({ field }) => (
              <ImageUpload
                label="Foto de portada de la web"
                folder="club"
                maxSize={1800}
                value={field.value}
                onChange={field.onChange}
                hint="Foto horizontal del club (cancha, equipo). Sin foto se usa una genérica."
              />
            )}
          />
          <div className="flex items-start gap-3">
            {(['primaryColor', 'secondaryColor'] as const).map((key) => (
              <label key={key} className="flex-1">
                <span className="mb-1.5 block text-[13px] font-semibold text-gray-700">
                  {key === 'primaryColor' ? 'Color principal' : 'Color secundario'}
                </span>
                <input
                  type="color"
                  {...register(key)}
                  className="h-10 w-full cursor-pointer rounded-xl border border-gray-300 bg-white p-1"
                />
                {errors[key] && <span className="mt-1 block text-sm text-red-600">{errors[key]?.message}</span>}
              </label>
            ))}
          </div>
          <Input
            label="Cuota social mensual"
            inputMode="decimal"
            hint="Se usa en el alta online cuando la categoría no tiene cuota propia"
            {...register('monthlyFee')}
            error={errors.monthlyFee?.message}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6" aria-labelledby="cfg-contacto">
        <h2 id="cfg-contacto" className="font-display text-lg font-bold text-gray-900">
          Datos de contacto
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {TEXT_FIELDS.map(({ key, label, hint, type }) => (
            <Input key={key} label={label} hint={hint} type={type} {...register(key)} error={errors[key]?.message} />
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-6" aria-labelledby="cfg-mp">
        <h2 id="cfg-mp" className="font-display text-lg font-bold text-gray-900">
          Mercado Pago
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Credenciales de producción de la cuenta del club (Tus integraciones, en el panel de Mercado Pago). Se guardan
          cifradas y acá se muestran enmascaradas: para cambiarlas, borrá el valor y pegá el nuevo.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Input label="Access token" autoComplete="off" placeholder="APP_USR-..." {...register('mpAccessToken')} error={errors.mpAccessToken?.message} />
          <Input
            label="Clave secreta del webhook"
            autoComplete="off"
            hint="Sin esta clave el club no recibe las confirmaciones de pago"
            {...register('mpWebhookSecret')}
            error={errors.mpWebhookSecret?.message}
          />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-400">Zona horaria del club: {config.timezone ?? '-'}</p>
        <Button type="submit" disabled={save.isPending || !isDirty}>
          {save.isPending ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}

function Configuracion() {
  const configQuery = useQuery<ClubConfig>({ queryKey: qk.clubConfig, queryFn: getClubConfig });
  if (configQuery.isPending) return <SkeletonRows count={3} height="h-48" />;
  if (configQuery.isError) return <ErrorState error={configQuery.error} onRetry={() => configQuery.refetch()} />;
  return <ConfigForm config={configQuery.data} />;
}

export default function ConfiguracionPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Configuración del club" description="Nombre, identidad visual, contacto y cobros online." />
      <RoleGuard roles={['ADMIN']}>
        <Configuracion />
      </RoleGuard>
    </div>
  );
}
