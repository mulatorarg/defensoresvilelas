'use client';

import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Newspaper, Pencil, Plus, Trash2 } from 'lucide-react';
import { deleteEvent, deleteNews, getEventsAdmin, getNewsAdmin, saveEvent, saveNews } from '@/lib/api';
import type { ClubEvent, NewsItem, PaginatedResponse } from '@/lib/types';
import { formatDate, formatDateTime, toClubDateTimeInput } from '@/lib/dates';
import { errorText, qk } from '@/lib/queries';
import { optionalText, requiredText } from '@/lib/validation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormActions } from '@/components/ui/FormActions';
import { ErrorState, SkeletonRows } from '@/components/ui/States';
import { useFeedback } from '@/components/ui/Feedback';
import { RoleGuard } from '@/components/common/RoleGuard';
import { ImageUpload } from '@/components/common/ImageUpload';

const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700';
const dangerBtn = 'flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600';

// ------------------------------------------------------------------ Noticias

const newsSchema = z.object({
  title: requiredText('Título'),
  excerpt: optionalText(1000),
  content: z.string(),
  imageUrl: z.string(),
  published: z.boolean(),
});
type NewsValues = z.infer<typeof newsSchema>;

function NewsForm({ item, onSubmit, onCancel, isLoading }: { item: NewsItem | null; onSubmit: (v: NewsValues) => void; onCancel: () => void; isLoading: boolean }) {
  const { register, control, handleSubmit, formState: { errors } } = useForm<NewsValues>({
    resolver: zodResolver(newsSchema),
    defaultValues: {
      title: item?.title ?? '',
      excerpt: item?.excerpt ?? '',
      content: item?.content ?? '',
      imageUrl: item?.imageUrl ?? '',
      published: item?.published ?? false,
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input label="Título" {...register('title')} error={errors.title?.message} />
      <Textarea label="Resumen" hint="Lo que se muestra en la tarjeta de la web" {...register('excerpt')} error={errors.excerpt?.message} />
      <Textarea label="Texto completo" rows={6} {...register('content')} />
      <Controller
        control={control}
        name="imageUrl"
        render={({ field }) => <ImageUpload label="Imagen" folder="noticias" value={field.value} onChange={field.onChange} />}
      />
      <Checkbox label="Publicada" hint="Visible en la web del club" {...register('published')} />
      <FormActions onCancel={onCancel} isLoading={isLoading} submitLabel="Guardar" />
    </form>
  );
}

function NewsSection() {
  const { toast, confirmAction } = useFeedback();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<NewsItem | 'new' | null>(null);
  const newsQuery = useQuery<PaginatedResponse<NewsItem>>({ queryKey: qk.news, queryFn: () => getNewsAdmin(1, 50) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.news });

  const save = useMutation({
    mutationFn: (v: NewsValues) =>
      saveNews(editing && editing !== 'new' ? editing.id : null, {
        ...v,
        excerpt: v.excerpt || null,
        content: v.content || null,
        imageUrl: v.imageUrl || null,
      }),
    onSuccess: (_r, v) => {
      toast(v.published ? 'Noticia publicada' : 'Noticia guardada como borrador');
      setEditing(null);
      refresh();
    },
    onError: (err) => toast(errorText(err, 'Error al guardar'), 'error'),
  });

  const handleDelete = async (item: NewsItem) => {
    const ok = await confirmAction({
      title: '¿Borrar esta noticia?',
      message: `"${item.title}" deja de verse en la web. No se puede deshacer.`,
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteNews(item.id);
      toast('Noticia borrada');
      refresh();
    } catch (err) {
      toast(errorText(err, 'Error al borrar'), 'error');
    }
  };

  const items = newsQuery.data?.items ?? [];
  const inEdit = editing && editing !== 'new' ? editing : null;

  return (
    <section aria-labelledby="noticias-titulo">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="noticias-titulo" className="font-display text-lg font-bold text-gray-900">
          Noticias
        </h2>
        <Button size="sm" onClick={() => setEditing('new')} icon={<Plus className="h-4 w-4" aria-hidden />}>
          Nueva noticia
        </Button>
      </div>
      {newsQuery.isPending ? (
        <SkeletonRows count={3} />
      ) : newsQuery.isError ? (
        <ErrorState error={newsQuery.error} onRetry={() => newsQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="h-7 w-7 text-gray-400" aria-hidden />}
          title="Todavía no hay noticias"
          hint="Las publicadas aparecen en la web del club."
        />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 p-4">
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.imageUrl} alt="" className="hidden h-14 w-20 rounded-lg object-cover sm:block" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900">{item.title}</p>
                <p className="text-xs">
                  {item.published ? (
                    <span className="font-semibold text-green-700">
                      Publicada el {formatDate(item.publishedAt, { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  ) : (
                    <span className="font-semibold text-amber-600">Borrador</span>
                  )}
                </p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setEditing(item)} className={iconBtn} aria-label={`Editar "${item.title}"`} title="Editar">
                  <Pencil className="h-4 w-4" aria-hidden />
                </button>
                <button onClick={() => handleDelete(item)} className={dangerBtn} aria-label={`Borrar "${item.title}"`} title="Borrar">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={inEdit ? 'Editar noticia' : 'Nueva noticia'}>
        {editing !== null && (
          <NewsForm key={inEdit?.id ?? 'new'} item={inEdit} onSubmit={(v) => save.mutate(v)} onCancel={() => setEditing(null)} isLoading={save.isPending} />
        )}
      </Modal>
    </section>
  );
}

// ------------------------------------------------------------------- Eventos

const eventSchema = z.object({
  title: requiredText('Título'),
  description: z.string(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'Elegí fecha y hora'),
  location: optionalText(),
  isPublic: z.boolean(),
});
type EventValues = z.infer<typeof eventSchema>;

function EventForm({ item, onSubmit, onCancel, isLoading }: { item: ClubEvent | null; onSubmit: (v: EventValues) => void; onCancel: () => void; isLoading: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm<EventValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: item?.title ?? '',
      description: item?.description ?? '',
      eventDate: toClubDateTimeInput(item?.eventDate),
      location: item?.location ?? '',
      isPublic: item?.isPublic ?? true,
    },
  });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Input label="Título" {...register('title')} error={errors.title?.message} />
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Fecha y hora (Argentina)" type="datetime-local" {...register('eventDate')} error={errors.eventDate?.message} />
        <Input label="Lugar" {...register('location')} error={errors.location?.message} />
      </div>
      <Textarea label="Descripción" {...register('description')} />
      <Checkbox label="Público" hint="Visible en la agenda de la web" {...register('isPublic')} />
      <FormActions onCancel={onCancel} isLoading={isLoading} submitLabel="Guardar" />
    </form>
  );
}

function EventsSection() {
  const { toast, confirmAction } = useFeedback();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ClubEvent | 'new' | null>(null);
  const [now] = useState(() => Date.now()); // para marcar los eventos que ya pasaron
  const eventsQuery = useQuery<PaginatedResponse<ClubEvent>>({ queryKey: qk.events, queryFn: () => getEventsAdmin(1, 50) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: qk.events });

  const save = useMutation({
    // datetime-local va sin zona: la API lo toma como hora del club
    mutationFn: (v: EventValues) =>
      saveEvent(editing && editing !== 'new' ? editing.id : null, {
        ...v,
        description: v.description || null,
        location: v.location || null,
      }),
    onSuccess: () => {
      toast('Evento guardado');
      setEditing(null);
      refresh();
    },
    onError: (err) => toast(errorText(err, 'Error al guardar'), 'error'),
  });

  const handleDelete = async (item: ClubEvent) => {
    const ok = await confirmAction({
      title: '¿Borrar este evento?',
      message: `"${item.title}" deja de verse en la agenda de la web.`,
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEvent(item.id);
      toast('Evento borrado');
      refresh();
    } catch (err) {
      toast(errorText(err, 'Error al borrar'), 'error');
    }
  };

  const items = eventsQuery.data?.items ?? [];
  const inEdit = editing && editing !== 'new' ? editing : null;

  return (
    <section aria-labelledby="eventos-titulo">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="eventos-titulo" className="font-display text-lg font-bold text-gray-900">
          Agenda de eventos
        </h2>
        <Button size="sm" onClick={() => setEditing('new')} icon={<Plus className="h-4 w-4" aria-hidden />}>
          Nuevo evento
        </Button>
      </div>
      {eventsQuery.isPending ? (
        <SkeletonRows count={3} />
      ) : eventsQuery.isError ? (
        <ErrorState error={eventsQuery.error} onRetry={() => eventsQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-7 w-7 text-gray-400" aria-hidden />}
          title="No hay eventos cargados"
          hint="Los próximos eventos públicos aparecen en la web."
        />
      ) : (
        <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
          {items.map((item) => {
            const past = new Date(item.eventDate).getTime() < now;
            return (
              <li key={item.id} className={`flex items-center gap-4 p-4 ${past ? 'opacity-60' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">
                    {formatDateTime(item.eventDate)}
                    {item.location && ` · ${item.location}`}
                    {past && ' · Ya pasó'}
                    {!item.isPublic && ' · Privado'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(item)} className={iconBtn} aria-label={`Editar "${item.title}"`} title="Editar">
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button onClick={() => handleDelete(item)} className={dangerBtn} aria-label={`Borrar "${item.title}"`} title="Borrar">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal isOpen={editing !== null} onClose={() => setEditing(null)} title={inEdit ? 'Editar evento' : 'Nuevo evento'}>
        {editing !== null && (
          <EventForm key={inEdit?.id ?? 'new'} item={inEdit} onSubmit={(v) => save.mutate(v)} onCancel={() => setEditing(null)} isLoading={save.isPending} />
        )}
      </Modal>
    </section>
  );
}

export default function NoticiasPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Noticias y eventos" description="Lo que se publica en la web del club." />
      <RoleGuard roles={['ADMIN', 'OPERATOR']}>
        <div className="space-y-10">
          <NewsSection />
          <EventsSection />
        </div>
      </RoleGuard>
    </div>
  );
}
