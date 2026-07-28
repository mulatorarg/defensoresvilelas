'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getPublicDisciplines,
  getPublicEvents,
  getPublicNews,
  getPublicClub,
} from '../lib/api';
import RegistroSocio from './RegistroSocio';

interface PublicTenant {
  name: string;
  legalName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  monthlyFee?: string | null;
}

interface PublicCategory {
  id: string;
  name: string;
  ageFrom?: number | null;
  ageTo?: number | null;
  schedule?: string | null;
}

interface PublicDiscipline {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  categories: PublicCategory[];
}

interface PublicNews {
  id: string;
  title: string;
  excerpt?: string | null;
  imageUrl?: string | null;
  publishedAt?: string | null;
}

interface PublicEvent {
  id: string;
  title: string;
  description?: string | null;
  eventDate: string;
  location?: string | null;
}

const NAV_LINKS = [
  { href: '#disciplinas', label: 'Disciplinas' },
  { href: '#agenda', label: 'Agenda' },
  { href: '#noticias', label: 'Noticias' },
  { href: '#asociate', label: 'Asociate' },
];

/* Fotos placeholder (Unsplash) — reemplazar por fotos reales del club */
const UNSPLASH = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=60`;

const HERO_PHOTO = UNSPLASH('photo-1459865264687-595d652de67e', 1800);

const SPORT_PHOTOS: Array<[RegExp, string]> = [
  [/f[uú]t|soccer/i, UNSPLASH('photo-1574629810360-7efbbe195018')],
  [/b[aá]squet|basket/i, UNSPLASH('photo-1546519638-68e109498ffc')],
  [/v[oó]ley|volley/i, UNSPLASH('photo-1554068865-24cecd4e34b8')],
  [/hockey|hoquey/i, UNSPLASH('photo-1580748141549-71748dbe0bdc')],
];
const DEFAULT_SPORT_PHOTO = UNSPLASH('photo-1461896836934-ffe607ba8211');

const LIFE_PHOTOS = [
  UNSPLASH('photo-1529900748604-07564a03e7a6', 1200),
  UNSPLASH('photo-1461896836934-ffe607ba8211', 1200),
  UNSPLASH('photo-1517649763962-0c623066013b', 1200),
];

const NEWS_PHOTOS = [
  UNSPLASH('photo-1522778119026-d647f0596c20'),
  UNSPLASH('photo-1546519638-68e109498ffc'),
  UNSPLASH('photo-1574629810360-7efbbe195018'),
];

function sportPhoto(name: string) {
  const match = SPORT_PHOTOS.find(([re]) => re.test(name));
  return match ? match[1] : DEFAULT_SPORT_PHOTO;
}

const gradientText = {
  backgroundImage:
    'linear-gradient(100deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 35%, white))',
};

const gradientBg = {
  backgroundImage:
    'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
};

function formatDate(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
  });
}

function ageLabel(cat: PublicCategory) {
  if (cat.ageFrom && cat.ageTo) return `${cat.ageFrom}–${cat.ageTo} años`;
  if (cat.ageFrom) return `+${cat.ageFrom} años`;
  if (cat.ageTo) return `hasta ${cat.ageTo} años`;
  return 'todas las edades';
}

function SectionHeader({
  index,
  title,
  subtitle,
}: {
  index: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="reveal mb-14">
      <p className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.35em] text-white/40">
        <span className="font-display text-primary">{index}</span>
        <span className="h-px w-10 bg-white/15" />
        {title}
      </p>
      {subtitle && (
        <h2 className="max-w-2xl font-display text-3xl font-bold tracking-tight text-white md:text-5xl">
          {subtitle}
        </h2>
      )}
    </div>
  );
}

export default function HomePage() {
  const [tenant, setTenant] = useState<PublicTenant>({ name: 'Nuestro Club' });
  const [disciplines, setDisciplines] = useState<PublicDiscipline[]>([]);
  const [news, setNews] = useState<PublicNews[]>([]);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getPublicClub()
      .then((t: PublicTenant) => {
        setTenant(t);
        if (t.primaryColor) {
          document.documentElement.style.setProperty('--color-primary', t.primaryColor);
        }
        if (t.secondaryColor) {
          document.documentElement.style.setProperty('--color-secondary', t.secondaryColor);
        }
      })
      .catch(() => {});
    getPublicDisciplines().then(setDisciplines).catch(() => {});
    getPublicNews(3).then(setNews).catch(() => {});
    getPublicEvents(4).then(setEvents).catch(() => {});
  }, []);

  // Reveal on scroll — se re-observa cuando llega contenido de la API
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    document.querySelectorAll('.reveal:not(.in)').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [disciplines, news, events]);

  const totalCategories = disciplines.reduce((acc, d) => acc + d.categories.length, 0);

  const marqueeItems = [
    ...(disciplines.length > 0
      ? disciplines.map((d) => d.name)
      : ['Fútbol', 'Básquet', 'Vóley', 'Hockey']),
    'El club del barrio',
    'Desde siempre',
  ];

  return (
    <main className="min-h-screen bg-[#05070e] text-white selection:bg-primary/40">
      {/* ===== Header ===== */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/6 bg-[#05070e]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="#" className="flex items-center gap-3">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={tenant.logoUrl}
                alt={tenant.name}
                className="h-10 w-10 object-contain drop-shadow"
              />
            ) : (
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl font-display text-sm font-bold text-white shadow-[0_0_24px_-6px_var(--color-primary)]"
                style={gradientBg}
              >
                {tenant.name.charAt(0)}
              </span>
            )}
            <span className="font-display text-[15px] font-semibold tracking-tight">
              {tenant.name}
            </span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[13px] font-medium uppercase tracking-[0.14em] text-white/50 transition-colors hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/socio/"
              className="rounded-full px-5 py-2 text-[13px] font-bold tracking-wide text-white shadow-[0_8px_30px_-10px_var(--color-primary)] transition-transform hover:scale-105"
              style={gradientBg}
            >
              Portal socios
            </Link>
            <Link
              href="/login/"
              className="rounded-full border border-white/15 bg-white/4 px-5 py-2 text-[13px] font-semibold tracking-wide text-white/90 transition-all hover:border-white/40 hover:bg-white/10"
            >
              Acceso
            </Link>
          </nav>

          <button
            className="px-2 text-2xl leading-none text-white/80 md:hidden"
            aria-label="Abrir menú"
            onClick={() => setMenuOpen((v) => !v)}
          >
            ☰
          </button>
        </div>
        {menuOpen && (
          <nav className="flex flex-col gap-4 border-t border-white/6 bg-[#05070e]/95 px-5 py-5 text-sm font-medium text-white/70 md:hidden">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
                {l.label}
              </a>
            ))}
            <Link href="/socio/" className="font-semibold text-primary">
              Portal socios
            </Link>
            <Link href="/login/" className="font-semibold text-white">
              Acceso
            </Link>
          </nav>
        )}
      </header>

      {/* ===== Hero ===== */}
      <section className="relative flex min-h-svh items-center overflow-hidden">
        {/* foto de fondo con Ken Burns + overlays */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="animate-kenburns absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${HERO_PHOTO})` }}
          />
          <div className="absolute inset-0 bg-[#05070e]/72" />
          <div
            className="absolute inset-0 opacity-50"
            style={{
              background:
                'radial-gradient(ellipse 70% 55% at 50% 42%, color-mix(in srgb, var(--color-primary) 28%, transparent), transparent 75%)',
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-56 bg-linear-to-b from-transparent to-[#05070e]" />
          <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-t from-transparent to-[#05070e]/80" />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-5 pb-24 pt-36 text-center">
          {tenant.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              className="animate-rise mx-auto mb-7 h-28 w-28 object-contain drop-shadow-[0_12px_35px_rgba(0,0,0,0.6)] md:h-36 md:w-36"
            />
          )}
          <div
            className="animate-rise mx-auto mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-black/30 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.25em] text-white/70 backdrop-blur"
            style={{ animationDelay: '0.05s' }}
          >
            <span
              className="animate-pulse-dot h-1.5 w-1.5 rounded-full"
              style={{ background: 'var(--color-primary)' }}
            />
            El club de tu barrio
          </div>

          <h1
            className="animate-rise font-display text-5xl font-extrabold leading-[1.02] tracking-tight md:text-8xl"
            style={{ animationDelay: '0.15s' }}
          >
            <span className="block text-white/95">Somos</span>
            <span className="block bg-clip-text text-transparent" style={gradientText}>
              {tenant.name}
            </span>
          </h1>

          <p
            className="animate-rise mx-auto mt-7 max-w-xl text-base leading-relaxed text-white/60 md:text-lg"
            style={{ animationDelay: '0.25s' }}
          >
            De la escuelita a la primera, acá se juega, se aprende y se hacen
            amigos para toda la vida. El club de siempre, con la gestión de un
            grande.
          </p>

          <div
            className="animate-rise mt-11 flex flex-wrap items-center justify-center gap-4"
            style={{ animationDelay: '0.35s' }}
          >
            <a
              href="#asociate"
              className="rounded-full px-8 py-3.5 text-sm font-bold tracking-wide text-white shadow-[0_12px_45px_-10px_var(--color-primary)] transition-transform hover:scale-[1.04]"
              style={gradientBg}
            >
              Quiero ser socio
            </a>
            <a
              href="#disciplinas"
              className="rounded-full border border-white/20 bg-black/25 px-8 py-3.5 text-sm font-semibold tracking-wide text-white/85 backdrop-blur transition-all hover:border-white/45 hover:text-white"
            >
              Conocé el club
            </a>
          </div>

          {disciplines.length > 0 && (
            <div
              className="animate-rise mx-auto mt-20 grid max-w-2xl grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-black/30 py-6 backdrop-blur"
              style={{ animationDelay: '0.45s' }}
            >
              {[
                [String(disciplines.length), 'Disciplinas'],
                [String(totalCategories), 'Categorías'],
                ['Abierta', 'Inscripción'],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="font-display text-2xl font-bold md:text-3xl">{value}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.25em] text-white/40">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== Marquee ===== */}
      <div className="relative overflow-hidden border-y border-white/7 bg-white/2 py-5">
        <div className="marquee-track items-center gap-14 pr-14">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center gap-14" aria-hidden={copy === 1}>
              {marqueeItems.map((item, i) => (
                <span key={`${copy}-${i}`} className="flex items-center gap-14">
                  <span className="font-display text-2xl font-extrabold uppercase tracking-tight text-white/85">
                    {item}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: 'var(--color-primary)' }}
                  />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ===== Disciplinas ===== */}
      <section id="disciplinas" className="relative mx-auto max-w-6xl scroll-mt-24 px-5 py-28">
        <SectionHeader
          index="01"
          title="Disciplinas"
          subtitle="Deporte para todas las edades, a metros de casa"
        />

        {disciplines.length === 0 ? (
          <p className="text-white/40">
            Muy pronto vas a encontrar acá todas nuestras actividades.
          </p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {disciplines.map((d, i) => (
              <article
                key={d.id}
                className="reveal group relative overflow-hidden rounded-3xl border border-white/8 bg-white/3 transition-all duration-300 hover:-translate-y-1.5 hover:border-white/20 hover:shadow-[0_25px_60px_-25px_var(--color-primary)]"
                style={{ transitionDelay: `${i * 0.08}s` }}
              >
                <div className="relative h-36 overflow-hidden">
                  <div
                    className="h-full w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                    style={{ backgroundImage: `url(${sportPhoto(d.name)})` }}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-[#0a0d18] via-[#0a0d18]/30 to-transparent" />
                  <span className="absolute bottom-3 left-4 text-2xl drop-shadow">{d.icon}</span>
                </div>
                <div className="p-6 pt-4">
                  <h3 className="font-display text-lg font-bold">{d.name}</h3>
                  {d.description && (
                    <p className="mt-2 text-[13px] leading-relaxed text-white/45">
                      {d.description}
                    </p>
                  )}
                  <ul className="mt-5 space-y-2.5 border-t border-white/7 pt-5">
                    {d.categories.map((c) => (
                      <li key={c.id} className="text-[13px]">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-semibold text-white/85">{c.name}</span>
                          <span className="shrink-0 text-[11px] text-white/35">
                            {ageLabel(c)}
                          </span>
                        </div>
                        {c.schedule && (
                          <p className="mt-0.5 text-[11px] tracking-wide text-white/30">
                            {c.schedule}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ===== La vida en el club (mosaico) ===== */}
      <section className="mx-auto max-w-6xl px-5 pb-28">
        <div className="grid gap-4 md:grid-cols-3">
          {LIFE_PHOTOS.map((photo, i) => (
            <div
              key={photo}
              className={`reveal group relative overflow-hidden rounded-3xl border border-white/8 ${
                i === 0 ? 'md:row-span-2 h-64 md:h-full' : 'h-64'
              }`}
              style={{ transitionDelay: `${i * 0.1}s` }}
            >
              <div
                className="h-full w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url(${photo})` }}
              />
              <div className="absolute inset-0 bg-linear-to-t from-[#05070e]/80 via-transparent to-transparent" />
              {i === 0 && (
                <p className="absolute bottom-6 left-6 max-w-60 font-display text-xl font-bold leading-snug">
                  La vida en el club, todos los días
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ===== Agenda ===== */}
      {events.length > 0 && (
        <section
          id="agenda"
          className="relative scroll-mt-24 border-y border-white/6 bg-white/1.5 py-28"
        >
          <div className="mx-auto max-w-6xl px-5">
            <SectionHeader index="02" title="Agenda" subtitle="Lo que se viene en el club" />
            <div className="grid gap-4 md:grid-cols-2">
              {events.map((e, i) => {
                const date = new Date(e.eventDate);
                return (
                  <article
                    key={e.id}
                    className="reveal flex items-center gap-6 rounded-3xl border border-white/8 bg-white/3 p-6 transition-colors hover:border-white/20"
                    style={{ transitionDelay: `${i * 0.08}s` }}
                  >
                    <div
                      className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow-[0_8px_30px_-8px_var(--color-primary)]"
                      style={gradientBg}
                    >
                      <span className="font-display text-2xl font-extrabold leading-none">
                        {date.getDate()}
                      </span>
                      <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest">
                        {date
                          .toLocaleDateString('es-AR', { month: 'short' })
                          .replace('.', '')}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-bold">{e.title}</h3>
                      {e.description && (
                        <p className="mt-1 text-[13px] text-white/45">{e.description}</p>
                      )}
                      {e.location && (
                        <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-white/30">
                          {e.location}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== Noticias ===== */}
      {news.length > 0 && (
        <section id="noticias" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-28">
          <SectionHeader index="03" title="Noticias" subtitle="Lo último del club" />
          <div className="grid gap-5 md:grid-cols-3">
            {news.map((n, i) => (
              <article
                key={n.id}
                className="reveal group flex flex-col overflow-hidden rounded-3xl border border-white/8 bg-white/3 transition-all duration-300 hover:-translate-y-1.5 hover:border-white/20"
                style={{ transitionDelay: `${i * 0.08}s` }}
              >
                <div className="relative h-44 overflow-hidden">
                  <div
                    className="h-full w-full bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                    style={{
                      backgroundImage: `url(${n.imageUrl || NEWS_PHOTOS[i % NEWS_PHOTOS.length]})`,
                    }}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-[#0a0d18]/70 to-transparent" />
                  <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur">
                    {formatDate(n.publishedAt)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-display text-lg font-bold leading-snug">{n.title}</h3>
                  {n.excerpt && (
                    <p className="mt-2.5 text-[13px] leading-relaxed text-white/45">
                      {n.excerpt}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ===== Tienda ===== */}
      <section className="mx-auto max-w-6xl px-5 pb-28">
        <div
          className="reveal rounded-4xl p-px"
          style={{
            backgroundImage:
              'linear-gradient(120deg, color-mix(in srgb, var(--color-primary) 60%, transparent), rgba(255,255,255,0.08), color-mix(in srgb, var(--color-secondary) 60%, transparent))',
          }}
        >
          <div className="relative overflow-hidden rounded-[calc(var(--radius-4xl)-1px)] bg-[#080b16] px-8 py-14 text-center md:px-16">
            <div
              className="pointer-events-none absolute -top-32 left-1/2 h-64 w-xl -translate-x-1/2 rounded-full opacity-20 blur-[90px]"
              style={{ background: 'var(--color-primary)' }}
            />
            <p className="relative mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-white/40">
              Tienda oficial
            </p>
            <h2 className="relative font-display text-3xl font-bold md:text-4xl">
              Vestí los colores del club
            </h2>
            <p className="relative mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/50">
              Camisetas, indumentaria y productos oficiales, con pago online
              mediante Mercado Pago y retiro en sede.
            </p>
            <span className="relative mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-xs font-bold uppercase tracking-[0.25em] text-white/70">
              <span
                className="animate-pulse-dot h-1.5 w-1.5 rounded-full"
                style={{ background: 'var(--color-primary)' }}
              />
              Próximamente
            </span>
          </div>
        </div>
      </section>

      {/* ===== Asociate ===== */}
      <section id="asociate" className="relative scroll-mt-24 border-t border-white/6 py-28">
        <div className="mx-auto max-w-6xl px-5">
          <div className="grid gap-14 lg:grid-cols-2">
            <div>
              <SectionHeader index="04" title="Asociate" subtitle="Hacete socio hoy, 100% online" />
              <p className="reveal -mt-6 max-w-md text-sm leading-relaxed text-white/50">
                Ser socio es mucho más que una cuota: es bancar al club del
                barrio, tener tu carnet digital con QR, descuentos en la tienda
                y pagar todo online, sin filas ni vueltas.
              </p>
              <div className="mt-9 space-y-4">
                {[
                  ['🎽', 'Todas las disciplinas', 'Una sola cuota social, acceso completo a las actividades del club.'],
                  ['📱', 'Carnet digital con QR', 'Tu credencial siempre en el teléfono, con acceso al predio y beneficios.'],
                  ['💳', 'Pagos 100% online', 'Cuotas y aranceles online, sin filas ni efectivo.'],
                ].map(([icon, title, desc], i) => (
                  <div
                    key={title}
                    className="reveal flex items-start gap-5 rounded-3xl border border-white/8 bg-white/3 p-6 transition-colors hover:border-white/20"
                    style={{ transitionDelay: (i * 0.1) + 's' }}
                  >
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <h3 className="font-display text-[15px] font-bold">{title}</h3>
                      <p className="mt-1 text-[13px] leading-relaxed text-white/45">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="reveal">
              <RegistroSocio disciplines={disciplines} monthlyFee={tenant.monthlyFee} />
            </div>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-white/6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-5 text-[13px] text-white/35 md:flex-row">
          <div className="flex items-center gap-3">
            {tenant.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenant.logoUrl} alt="" className="h-8 w-8 object-contain" />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg font-display text-xs font-bold text-white"
                style={gradientBg}
              >
                {tenant.name.charAt(0)}
              </span>
            )}
            <span className="font-display font-semibold text-white/80">{tenant.name}</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-6">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="transition-colors hover:text-white">
                {l.label}
              </a>
            ))}
          </nav>
          <p>
            Gestión con <span className="text-white/70">Clubes</span> ·{' '}
            <Link
              href="/login/"
              className="underline-offset-2 transition-colors hover:text-white hover:underline"
            >
              Administración
            </Link>{' '}
            · <span className="font-mono text-[11px] text-white/25">{process.env.NEXT_PUBLIC_BUILD_SHA}</span>
          </p>
        </div>
      </footer>
    </main>
  );
}
