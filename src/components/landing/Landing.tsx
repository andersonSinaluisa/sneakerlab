import { useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowRight, Box, Brush, ChevronDown, Footprints, ImagePlus, Layers, Package, Palette, Receipt, Share2, Sparkles, Type,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { FAQ } from "./content";

/**
 * Landing pública del negocio. Ligera a propósito: no carga three.js ni el editor;
 * todo lo que sea diseñar vive en /disenar.
 */

const EDITOR = "/disenar";

type Go = (e: React.MouseEvent, id: string) => void;

/** Diseños del catálogo con miniatura renderizada (public/designs/thumbs/<id>/). */
const FEATURED = [
  { id: "great-wave", name: "Great Wave", tag: "Olas japonesas" },
  { id: "sakura-dream", name: "Sakura Dream", tag: "Sakura" },
  { id: "neon-warrior", name: "Neon Warrior", tag: "Cyberpunk" },
  { id: "kawaii-neko", name: "Kawaii Neko", tag: "Kawaii" },
  { id: "manga-clash", name: "Manga Clash", tag: "Viñetas manga" },
  { id: "shadow-ronin", name: "Shadow Ronin", tag: "Samurái" },
  { id: "pixel-quest", name: "Pixel Quest", tag: "Gaming" },
  { id: "street-tag", name: "Street Tag", tag: "Grafiti" },
] as const;

const thumb = (id: string, view: "hero" | "both" | "outer" = "hero") => `/designs/thumbs/${id}/${view}.jpg`;

const STEPS = [
  { icon: Footprints, title: "Elige tu modelo", text: "Parte de una silueta base y gírala en 3D para verla desde cualquier ángulo." },
  { icon: Palette, title: "Diséñala pieza a pieza", text: "Color y material por zona, tus propias imágenes, textos y patrones. Pie izquierdo y derecho, iguales o distintos." },
  { icon: Package, title: "Pide y la fabricamos", text: "Ves el precio mientras diseñas. Confirmas el pedido y sigues su estado desde tu cuenta." },
];

const FEATURES = [
  { icon: Layers, title: "Hasta 13 zonas", text: "Puntera, laterales, talón, lengüeta, cordones, suela…" },
  { icon: Brush, title: "Materiales", text: "Cuero, gamuza, lona o malla técnica según la zona." },
  { icon: ImagePlus, title: "Tus ilustraciones", text: "Sube tus imágenes y colócalas sobre el zapato." },
  { icon: Type, title: "Textos y patrones", text: "Nombres, fechas o frases, incluso en curva." },
  { icon: Receipt, title: "Precio al instante", text: "La cotización se actualiza con cada cambio." },
  { icon: Share2, title: "Guarda y comparte", text: "Tu borrador se guarda solo; con cuenta, compártelo por enlace." },
];

export default function Landing() {
  const scroller = useRef<HTMLDivElement>(null);
  const go: Go = (e, id) => {
    e.preventDefault();
    scroller.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={scroller} className="h-dvh overflow-y-auto scroll-smooth bg-[#f4f3f0] text-neutral-900">
      <Nav go={go} />
      <Hero go={go} />
      <Strip />
      <Steps />
      <Gallery />
      <Features />
      <Faq />
      <FinalCta />
      <Footer go={go} />
    </div>
  );
}

function Logo({ invert = false }: { invert?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("flex size-8 items-center justify-center rounded-lg text-[11px] font-bold tracking-tight", invert ? "bg-white text-neutral-900" : "bg-neutral-900 text-white")}>HP</span>
      <span className="text-[15px] font-semibold tracking-tight">Hecho a Pie</span>
    </span>
  );
}

function CtaLink({ to, children, variant = "dark", className }: { to: string; children: React.ReactNode; variant?: "dark" | "light" | "outline"; className?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900",
        variant === "dark" && "bg-neutral-900 text-white hover:bg-neutral-700",
        variant === "light" && "bg-white text-neutral-900 hover:bg-neutral-200",
        variant === "outline" && "border border-neutral-300 bg-white/60 text-neutral-900 hover:bg-white",
        className,
      )}
    >
      {children}
    </Link>
  );
}

function Nav({ go }: { go: Go }) {
  const link = "rounded-full px-3 py-1.5 text-[13px] text-neutral-600 transition-colors hover:bg-white hover:text-neutral-900";
  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200/70 bg-[#f4f3f0]/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 lg:px-8">
        <Link to="/" aria-label="Hecho a Pie, inicio"><Logo /></Link>
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Secciones">
          <a href="#como-funciona" className={link} onClick={(e) => go(e, "como-funciona")}>Cómo funciona</a>
          <a href="#disenos" className={link} onClick={(e) => go(e, "disenos")}>Diseños</a>
          <a href="#preguntas" className={link} onClick={(e) => go(e, "preguntas")}>Preguntas</a>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/orders" className={cn(link, "hidden sm:inline-flex")}>Mis pedidos</Link>
          <CtaLink to={EDITOR} className="h-9 px-4 text-[13px]">Diseñar <ArrowRight className="size-4" /></CtaLink>
        </div>
      </div>
    </header>
  );
}

function Hero({ go }: { go: Go }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-10 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:px-8 lg:pb-20 lg:pt-16">
      <div>
        <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-neutral-300/80 bg-white/70 px-3 py-1 text-xs text-neutral-600">
          <Sparkles className="size-3.5" /> Zapatillas personalizadas, diseñadas en 3D
        </p>
        <h1 className="text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[72px]">
          Tus zapatillas,<br />
          <span className="text-neutral-400">hechas a tu pie.</span>
        </h1>
        <p className="mt-6 max-w-md text-[17px] leading-relaxed text-neutral-600">
          Elige cada color, material, ilustración y texto en un editor 3D que ves girar en tiempo real. Tú las diseñas; nosotros las fabricamos.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <CtaLink to={EDITOR}>Empezar a diseñar <ArrowRight className="size-4" /></CtaLink>
          <a
            href="#disenos"
            onClick={(e) => go(e, "disenos")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white/60 px-5 text-sm font-medium transition-colors hover:bg-white"
          >
            Ver diseños
          </a>
        </div>
      </div>

      <div className="relative">
        <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] bg-[#e9e8e4]">
          <img src={thumb("great-wave")} alt="Zapatilla personalizada con olas japonesas azules" className="absolute inset-0 size-full scale-110 object-cover mix-blend-multiply" fetchPriority="high" />
        </div>
        <div className="absolute -bottom-6 -left-4 w-[44%] overflow-hidden rounded-2xl border-4 border-[#f4f3f0] bg-[#e9e8e4] shadow-xl shadow-neutral-900/10 sm:-left-8">
          <img src={thumb("neon-warrior", "both")} alt="Par de zapatillas negras con detalles neón" className="aspect-[4/3] w-full scale-125 object-cover mix-blend-multiply" loading="lazy" />
        </div>
        <div className="absolute -right-2 top-5 rounded-2xl bg-white px-4 py-3 shadow-lg shadow-neutral-900/5 sm:-right-5">
          <div className="text-[11px] text-neutral-500">Cada pie, a tu manera</div>
          <div className="mt-1 flex gap-1.5">
            {["#1d4ed8", "#f4f3f0", "#f9a8d4", "#171717", "#a855f7"].map((c) => (
              <span key={c} className="size-5 rounded-full ring-1 ring-black/10" style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Strip() {
  const items = ["Vista 3D en tiempo real", "Pie izquierdo y derecho independientes", "Precio mientras diseñas", "Sube tus ilustraciones", "Seguimiento del pedido"];
  return (
    <div className="border-y border-neutral-200/80 bg-white/50">
      <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-8 gap-y-2 px-4 py-5 text-[13px] text-neutral-600 lg:justify-between lg:px-8">
        {items.map((t) => (
          <li key={t} className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-neutral-900" />{t}</li>
        ))}
      </ul>
    </div>
  );
}

function SectionHead({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">{eyebrow}</p>
      <h2 className="text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-[16px] leading-relaxed text-neutral-600">{text}</p>}
    </div>
  );
}

function Steps() {
  return (
    <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 lg:px-8 lg:py-28">
      <SectionHead eyebrow="Cómo funciona" title="Del navegador a tus pies, en tres pasos." />
      <ol className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-3xl border border-neutral-200/80 bg-white p-6">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-neutral-100"><s.icon className="size-5" /></span>
              <span className="font-mono text-sm text-neutral-300">0{i + 1}</span>
            </div>
            <h3 className="mt-6 text-lg font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Gallery() {
  return (
    <section id="disenos" className="scroll-mt-16 bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead eyebrow="Diseños de zapatillas" title="Empieza desde uno de los nuestros." text="Ábrelo en el editor y cámbiale lo que quieras: colores, imágenes, textos o el pie que prefieras." />
          <CtaLink to={EDITOR} variant="outline" className="mb-10">Empezar desde cero</CtaLink>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {FEATURED.map((d) => (
            <li key={d.id}>
              <Link to={`${EDITOR}?diseno=${d.id}`} className="group block focus-visible:outline-none">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-[#ebeae6] ring-neutral-900 transition group-focus-visible:ring-2">
                  <img src={thumb(d.id)} alt={`Diseño ${d.name}`} loading="lazy" className="size-full scale-105 object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-110" />
                  <span className="absolute inset-x-3 bottom-3 flex translate-y-2 items-center justify-center gap-1.5 rounded-full bg-neutral-900 py-2 text-xs font-medium text-white opacity-0 transition group-hover:translate-y-0 group-hover:opacity-100">
                    Personalizar <ArrowRight className="size-3.5" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-2 px-1">
                  <span className="text-[14px] font-medium">{d.name}</span>
                  <span className="hidden text-xs text-neutral-500 sm:inline">{d.tag}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 lg:px-8 lg:py-28">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <div className="relative aspect-square overflow-hidden rounded-[28px] bg-[#e9e8e4]">
          <img src={thumb("sakura-dream", "outer")} alt="Lateral de una zapatilla con ramas de sakura" loading="lazy" className="size-full object-cover mix-blend-multiply" />
          <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow-sm">
            <Box className="size-3.5" /> Gíralo, acércate, revisa cada costura
          </div>
        </div>
        <div>
          <SectionHead eyebrow="Personalización" title="Todo lo que puedes cambiar." />
          <ul className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <f.icon className="mt-0.5 size-5 shrink-0 text-neutral-900" />
                <div>
                  <h3 className="text-[15px] font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-neutral-600">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="preguntas" className="scroll-mt-16 border-t border-neutral-200/80 py-20 lg:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[1fr_1.6fr] lg:px-8">
        <SectionHead eyebrow="Preguntas frecuentes" title="Lo que suele preguntarse." />
        <ul className="divide-y divide-neutral-200 border-y border-neutral-200">
          {FAQ.map((f, i) => {
            const isOpen = open === i;
            return (
              <li key={f.q}>
                <button
                  className="flex w-full items-center justify-between gap-4 py-5 text-left text-[16px] font-medium"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  {f.q}
                  <ChevronDown className={cn("size-5 shrink-0 text-neutral-400 transition-transform", isOpen && "rotate-180")} />
                </button>
                <div className={cn("grid transition-[grid-template-rows] duration-300", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
                  <p className="overflow-hidden pr-8 text-[15px] leading-relaxed text-neutral-600">
                    <span className="block pb-5">{f.a}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-4 pb-20 lg:px-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-neutral-900 px-6 py-14 text-white sm:px-12 lg:py-20">
        <div className="relative z-10 max-w-lg">
          <h2 className="text-3xl font-semibold tracking-[-0.025em] sm:text-5xl">Nadie más tendrá unas iguales.</h2>
          <p className="mt-4 text-[16px] leading-relaxed text-neutral-400">Abre el editor, juega con tu idea y mira el precio al momento. Sin registro para empezar.</p>
          <CtaLink to={EDITOR} variant="light" className="mt-8">Diseñar mis zapatillas <ArrowRight className="size-4" /></CtaLink>
        </div>
        <div className="pointer-events-none absolute -right-16 bottom-0 hidden w-[52%] opacity-90 md:block">
          <img src={thumb("kawaii-neko", "both")} alt="" loading="lazy" className="w-full rounded-tl-[40px] grayscale-[15%]" />
        </div>
      </div>
    </section>
  );
}

function Footer({ go }: { go: Go }) {
  const a = "text-[13px] text-neutral-500 transition-colors hover:text-neutral-900";
  return (
    <footer className="border-t border-neutral-200/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>
          <Logo />
          <p className="mt-2 text-[13px] text-neutral-500">Zapatillas personalizadas, diseñadas por ti.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Pie de página">
          <Link to={EDITOR} className={a}>Diseñar</Link>
          <a href="#disenos" className={a} onClick={(e) => go(e, "disenos")}>Diseños</a>
          <a href="#preguntas" className={a} onClick={(e) => go(e, "preguntas")}>Preguntas</a>
          <Link to="/orders" className={a}>Mis pedidos</Link>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-8 text-xs text-neutral-400 lg:px-8" suppressHydrationWarning>© {new Date().getFullYear()} Hecho a Pie</div>
    </footer>
  );
}
