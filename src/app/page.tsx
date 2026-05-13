"use client";

import { useState } from "react";

const VEHICLES = [
  { label: "Otobüs / Metro / Tramvay", short: "Otobüs · Metro · Tramvay", icon: "◆", price: 42.0 },
  { label: "Metrobüs (kısa mesafe)", short: "Metrobüs · kısa", icon: "▶", price: 30.07 },
  { label: "Metrobüs (uzun mesafe)", short: "Metrobüs · uzun", icon: "▶▶", price: 51.96 },
  { label: "Vapur — Kadıköy / Eminönü", short: "Vapur", icon: "≈", price: 59.28 },
  { label: "Marmaray (1–7 durak)", short: "Marmaray", icon: "═", price: 34.0 },
  { label: "1. aktarma indirimi", short: "1. aktarma", icon: "↻", price: 31.27 },
  { label: "2. aktarma indirimi", short: "2. aktarma", icon: "↻↻", price: 24.02 },
];

const fmt = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTL = (n: number) => `${fmt(n)} ₺`;

type Leg = { id: number; vIdx: number; label: string; isTransfer: boolean };
type Profile = { name: string; days: number; going: Leg[]; returning: Leg[] };

let uid = 1;
const newLeg = (vIdx = 0): Leg => ({ id: uid++, vIdx, label: "", isTransfer: false });

const defaultStandard: Profile = {
  name: "Standart güzergah",
  days: 18,
  going: [
    { id: uid++, vIdx: 0, label: "62 / 62G", isTransfer: false },
    { id: uid++, vIdx: 2, label: "34AS / 34G", isTransfer: false },
    { id: uid++, vIdx: 5, label: "M4 Metro", isTransfer: true },
    { id: uid++, vIdx: 6, label: "14BK / 20U", isTransfer: true },
  ],
  returning: [
    { id: uid++, vIdx: 0, label: "14BK / 20U", isTransfer: false },
    { id: uid++, vIdx: 2, label: "Metrobüs", isTransfer: false },
    { id: uid++, vIdx: 5, label: "62", isTransfer: true },
  ],
};

const defaultClient: Profile = {
  name: "Müşteri ziyareti",
  days: 4,
  going: [newLeg(0)],
  returning: [newLeg(0)],
};

export default function UlasimHesaplayici() {
  const [profiles, setProfiles] = useState<Profile[]>([defaultStandard, defaultClient]);
  const [totalWorkdays, setTotalWorkdays] = useState(22);
  const [copied, setCopied] = useState(false);

  const updateProfile = <K extends keyof Profile>(pi: number, key: K, val: Profile[K]) =>
    setProfiles((p) => p.map((x, i) => (i === pi ? { ...x, [key]: val } : x)));

  const updateLeg = <K extends keyof Leg>(
    pi: number,
    dir: "going" | "returning",
    id: number,
    key: K,
    val: Leg[K],
  ) =>
    setProfiles((p) =>
      p.map((x, i) =>
        i !== pi
          ? x
          : { ...x, [dir]: x[dir].map((l) => (l.id === id ? { ...l, [key]: val } : l)) },
      ),
    );

  const addLeg = (pi: number, dir: "going" | "returning") =>
    setProfiles((p) => p.map((x, i) => (i !== pi ? x : { ...x, [dir]: [...x[dir], newLeg()] })));

  const removeLeg = (pi: number, dir: "going" | "returning", id: number) =>
    setProfiles((p) =>
      p.map((x, i) => (i !== pi ? x : { ...x, [dir]: x[dir].filter((l) => l.id !== id) })),
    );

  const addProfile = () =>
    setProfiles((p) => [
      ...p,
      { name: `Güzergah ${p.length + 1}`, days: 1, going: [newLeg()], returning: [newLeg()] },
    ]);

  const removeProfile = (pi: number) => setProfiles((p) => p.filter((_, i) => i !== pi));

  const legsTotal = (legs: Leg[]) => legs.reduce((s, l) => s + VEHICLES[l.vIdx].price, 0);
  const profileDay = (p: Profile) => legsTotal(p.going) + legsTotal(p.returning);
  const profileMon = (p: Profile) => profileDay(p) * (Number(p.days) || 0);
  const grandTotal = profiles.reduce((s, p) => s + profileMon(p), 0);
  const assignedDays = profiles.reduce((s, p) => s + (Number(p.days) || 0), 0);

  const reqText = () => {
    const today = new Date().toLocaleDateString("tr-TR");
    const lines = profiles
      .map((p) => {
        const legLines = (legs: Leg[]) =>
          legs
            .map((l) => {
              const vName = VEHICLES[l.vIdx].label;
              const hat = l.label ? ` (${l.label})` : "";
              const tag = l.isTransfer ? " [aktarma]" : "";
              return `    • ${vName}${hat}${tag} — ${fmtTL(VEHICLES[l.vIdx].price)}`;
            })
            .join("\n");

        return [
          `${p.name}`,
          `  Gidiş:`,
          legLines(p.going),
          `  Dönüş:`,
          legLines(p.returning),
          `  Günlük   : ${fmtTL(profileDay(p))}`,
          `  Gün      : ${p.days}`,
          `  Ara top. : ${fmtTL(profileMon(p))}`,
        ].join("\n");
      })
      .join("\n\n");

    return [
      `Konu: Aylık ulaşım ücreti talebi`,
      `Tarih: ${today}`,
      ``,
      `İlgili departmana,`,
      ``,
      `Aylık toplu taşıma ulaşım giderime ilişkin ücret talebimi bilgilerinize sunarım.`,
      ``,
      lines,
      ``,
      `${"─".repeat(42)}`,
      `Toplam çalışma günü : ${totalWorkdays} gün`,
      `Aylık genel toplam  : ${fmtTL(grandTotal)}`,
      ``,
      `${fmtTL(grandTotal)} tutarının tarafıma ödenmesini saygılarımla talep ederim.`,
      ``,
      `(Kaynak: İBB UKOME, 16 Şubat 2026 güncel tarifesi)`,
    ].join("\n");
  };

  const copyText = () =>
    navigator.clipboard.writeText(reqText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

  return (
    <main className="relative mx-auto min-h-dvh max-w-5xl px-4 pb-24 pt-8 sm:px-8 sm:pt-12">
      {/* Top status bar */}
      <div className="flex items-center justify-between text-[11px] font-medium tracking-wide text-[var(--color-fg-dim)]">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="font-mono uppercase">canlı tarife</span>
        </div>
        <div className="chip">
          <span>İBB UKOME</span>
          <span className="text-[var(--color-fg)]">16.02.2026</span>
        </div>
      </div>

      {/* Hero */}
      <section className="relative mt-10 overflow-hidden rounded-[32px] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 sm:p-12">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-32 -top-32 size-[420px] rounded-full bg-[var(--color-lime)] opacity-[0.07] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 size-[380px] rounded-full bg-[var(--color-violet)] opacity-[0.10] blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="chip">
              <span className="size-1.5 rounded-full bg-[var(--color-lime)]" />
              İstanbul · 2026
            </span>
            <span className="chip">{profiles.length} güzergah</span>
          </div>

          <h1 className="mt-6 text-[42px] font-medium leading-[1.05] tracking-tight sm:text-[64px]">
            Ulaşım <span className="italic text-[var(--color-fg-muted)]">defteriniz</span>.
            <br />
            <span className="text-[var(--color-fg-muted)]">Aylık masraf, </span>
            <span className="text-[var(--color-lime)]">tek tıkla</span>
            <span className="text-[var(--color-fg-muted)]">.</span>
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--color-fg-muted)]">
            Her güzergahınızı ekleyin, günleri girin — biz aylık tutarı ve şirkete
            göndereceğiniz talep metnini hazırlayalım.
          </p>

          {/* Stat row */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <HeroStat label="Aylık toplam" value={fmtTL(grandTotal)} primary />
            <HeroStat label="Çalışma günü" value={`${totalWorkdays}`} suffix="gün" />
            <HeroStat label="Güzergah" value={`${profiles.length}`} />
            <HeroStat
              label="Günlük ortalama"
              value={fmtTL(totalWorkdays > 0 ? grandTotal / totalWorkdays : 0)}
            />
          </div>
        </div>
      </section>

      {/* Fare marquee */}
      <div className="relative mt-6 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-2)]">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[var(--color-bg-2)] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[var(--color-bg-2)] to-transparent" />
        <div className="marquee-track flex whitespace-nowrap py-3 font-mono text-[12px] text-[var(--color-fg-muted)]">
          {[...VEHICLES, ...VEHICLES, ...VEHICLES].map((v, i) => (
            <span key={i} className="inline-flex items-center gap-2 px-6">
              <span className="text-[var(--color-lime)]">{v.icon}</span>
              <span>{v.short}</span>
              <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[var(--color-fg)]">
                {fmtTL(v.price)}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Workdays */}
      <section className="rise mt-8 flex flex-wrap items-end justify-between gap-6 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-fg-dim)]">
            01 · Çalışma günü
          </p>
          <h2 className="mt-2 text-2xl font-medium tracking-tight">
            Bu ay <span className="text-[var(--color-fg-muted)]">kaç gün</span> yola çıkıyorsunuz?
          </h2>
          {assignedDays !== totalWorkdays && (
            <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--color-rose)]/10 px-3 py-1 text-[11px] text-[var(--color-rose)]">
              <span className="size-1.5 rounded-full bg-[var(--color-rose)]" />
              Profillere atanan: {assignedDays} gün
            </p>
          )}
        </div>

        <div className="flex items-end gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-2 pr-5">
          <button
            onClick={() => setTotalWorkdays((d) => Math.max(1, d - 1))}
            className="size-11 rounded-xl bg-white/5 text-xl text-[var(--color-fg-muted)] transition hover:bg-white/10 hover:text-[var(--color-fg)]"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={31}
            value={totalWorkdays}
            onChange={(e) => setTotalWorkdays(Number(e.target.value) || 1)}
            className="w-20 bg-transparent text-center text-5xl font-medium tabular-nums tracking-tight outline-none"
          />
          <button
            onClick={() => setTotalWorkdays((d) => Math.min(31, d + 1))}
            className="size-11 rounded-xl bg-white/5 text-xl text-[var(--color-fg-muted)] transition hover:bg-white/10 hover:text-[var(--color-fg)]"
          >
            +
          </button>
          <span className="pb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-fg-dim)]">
            gün
          </span>
        </div>
      </section>

      {/* Profile cards */}
      <div className="mt-8 space-y-6">
        {profiles.map((p, pi) => (
          <ProfileCard
            key={pi}
            p={p}
            pi={pi}
            canRemove={profiles.length > 1}
            profileDay={profileDay(p)}
            profileMon={profileMon(p)}
            legsTotalGoing={legsTotal(p.going)}
            legsTotalReturning={legsTotal(p.returning)}
            updateProfile={updateProfile}
            updateLeg={updateLeg}
            addLeg={addLeg}
            removeLeg={removeLeg}
            removeProfile={removeProfile}
          />
        ))}
      </div>

      {/* Add profile */}
      <button
        onClick={addProfile}
        className="group mt-6 w-full rounded-3xl border border-dashed border-white/15 bg-transparent py-6 text-[var(--color-fg-muted)] transition hover:border-[var(--color-lime)] hover:bg-[var(--color-lime-soft)] hover:text-[var(--color-lime)]"
      >
        <span className="inline-flex items-center gap-3 text-base font-medium">
          <span className="grid size-7 place-items-center rounded-full border border-current">+</span>
          Yeni güzergah ekle
        </span>
      </button>

      {/* Grand total */}
      <section className="relative mt-10 overflow-hidden rounded-[32px] border border-[var(--color-border)] bg-gradient-to-br from-[#16161a] via-[#16161a] to-[#1f1f24] p-8 sm:p-12">
        <div className="pointer-events-none absolute -right-24 -top-24 size-[400px] rounded-full bg-[var(--color-lime)] opacity-[0.10] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/3 size-[300px] rounded-full bg-[var(--color-violet)] opacity-[0.10] blur-3xl" />

        <div className="relative flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="chip">
              <span className="live-dot" />
              Aylık genel toplam
            </span>
            <div className="mt-5 flex items-start gap-2 leading-none">
              <span className="text-[64px] font-medium tabular-nums tracking-tight text-[var(--color-lime)] sm:text-[88px]">
                {fmt(grandTotal)}
              </span>
              <span className="mt-3 text-3xl font-medium text-[var(--color-fg-muted)] sm:text-4xl">₺</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {profiles.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/[0.03] px-3 py-1.5 text-[12px]"
                >
                  <span className="text-[var(--color-fg-muted)]">{p.name}</span>
                  <span className="font-mono tabular-nums text-[var(--color-fg)]">
                    {fmtTL(profileMon(p))}
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 text-right font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
            <span>Tahakkuk</span>
            <span className="text-[var(--color-fg)]">
              {new Date().toLocaleDateString("tr-TR")}
            </span>
          </div>
        </div>
      </section>

      {/* Request letter */}
      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-fg-dim)]">
              02 · Talep metni
            </p>
            <h2 className="mt-2 text-2xl font-medium tracking-tight">
              Şirkete gönderilecek <span className="text-[var(--color-fg-muted)]">e-posta</span>
            </h2>
          </div>
          <button
            onClick={copyText}
            className={
              "group inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition " +
              (copied
                ? "bg-[var(--color-lime)] text-[#0a0a0c] glow-lime"
                : "bg-[var(--color-fg)] text-[#0a0a0c] hover:bg-[var(--color-lime)] hover:glow-lime")
            }
          >
            {copied ? (
              <>
                <span>✓</span>
                <span>Kopyalandı</span>
              </>
            ) : (
              <>
                <CopyIcon />
                <span>Metni kopyala</span>
              </>
            )}
          </button>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-2)] px-5 py-3">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[var(--color-rose)]" />
              <span className="size-2.5 rounded-full bg-[#fbbf24]" />
              <span className="size-2.5 rounded-full bg-[var(--color-lime)]" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-fg-dim)]">
              talep.txt
            </span>
            <span className="font-mono text-[10px] text-[var(--color-fg-dim)]">
              {reqText().split("\n").length} satır
            </span>
          </div>
          <textarea
            readOnly
            value={reqText()}
            rows={18}
            className="block w-full resize-y bg-transparent p-6 font-mono text-[12px] leading-[1.85] text-[var(--color-fg)] outline-none"
          />
        </div>
      </section>

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-6 text-[11px] text-[var(--color-fg-dim)]">
        <span className="font-mono uppercase tracking-[0.2em]">
          Kaynak · İBB UKOME 16.02.2026
        </span>
        <span>Ulaşım Defteri — 2026</span>
      </footer>
    </main>
  );
}

/* ───────────────────────── Hero stat ───────────────────────── */
function HeroStat({
  label,
  value,
  suffix,
  primary,
}: {
  label: string;
  value: string;
  suffix?: string;
  primary?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border p-4 " +
        (primary
          ? "border-[var(--color-lime)]/30 bg-[var(--color-lime-soft)]"
          : "border-[var(--color-border)] bg-white/[0.02]")
      }
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
        {label}
      </p>
      <p
        className={
          "mt-2 text-2xl font-medium tabular-nums tracking-tight sm:text-[28px] " +
          (primary ? "text-[var(--color-lime)]" : "text-[var(--color-fg)]")
        }
      >
        {value}
        {suffix && (
          <span className="ml-1 text-sm font-normal text-[var(--color-fg-muted)]">
            {suffix}
          </span>
        )}
      </p>
    </div>
  );
}

/* ───────────────────────── Profile card ───────────────────────── */
function ProfileCard({
  p,
  pi,
  canRemove,
  profileDay,
  profileMon,
  legsTotalGoing,
  legsTotalReturning,
  updateProfile,
  updateLeg,
  addLeg,
  removeLeg,
  removeProfile,
}: {
  p: Profile;
  pi: number;
  canRemove: boolean;
  profileDay: number;
  profileMon: number;
  legsTotalGoing: number;
  legsTotalReturning: number;
  updateProfile: <K extends keyof Profile>(pi: number, key: K, val: Profile[K]) => void;
  updateLeg: <K extends keyof Leg>(
    pi: number,
    dir: "going" | "returning",
    id: number,
    key: K,
    val: Leg[K],
  ) => void;
  addLeg: (pi: number, dir: "going" | "returning") => void;
  removeLeg: (pi: number, dir: "going" | "returning", id: number) => void;
  removeProfile: (pi: number) => void;
}) {
  const accents = ["var(--color-lime)", "var(--color-sky)", "var(--color-violet)", "var(--color-rose)"];
  const accent = accents[pi % accents.length];

  return (
    <article className="group/card relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] transition hover:border-[var(--color-border-strong)]">
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />

      <header className="flex flex-wrap items-center justify-between gap-4 px-6 pb-4 pt-6 sm:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl font-mono text-[11px] font-medium tabular-nums"
            style={{
              background: `color-mix(in srgb, ${accent} 14%, transparent)`,
              color: accent,
              border: `1px solid color-mix(in srgb, ${accent} 25%, transparent)`,
            }}
          >
            {String(pi + 1).padStart(2, "0")}
          </span>
          <input
            value={p.name}
            onChange={(e) => updateProfile(pi, "name", e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-xl font-medium tracking-tight outline-none placeholder:text-[var(--color-fg-dim)] focus:text-[var(--color-fg)]"
            placeholder="Güzergah adı"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-1">
            <button
              onClick={() =>
                updateProfile(pi, "days", Math.max(0, Number(p.days) - 1))
              }
              className="size-8 rounded-lg text-[var(--color-fg-muted)] transition hover:bg-white/5 hover:text-[var(--color-fg)]"
            >
              −
            </button>
            <input
              type="number"
              min={0}
              max={31}
              value={p.days}
              onChange={(e) =>
                updateProfile(pi, "days", Number(e.target.value) || 0)
              }
              className="w-10 bg-transparent text-center text-base font-medium tabular-nums outline-none"
            />
            <button
              onClick={() =>
                updateProfile(pi, "days", Math.min(31, Number(p.days) + 1))
              }
              className="size-8 rounded-lg text-[var(--color-fg-muted)] transition hover:bg-white/5 hover:text-[var(--color-fg)]"
            >
              +
            </button>
            <span className="px-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
              gün
            </span>
          </div>
          {canRemove && (
            <button
              onClick={() => removeProfile(pi)}
              className="size-10 rounded-xl border border-[var(--color-border)] bg-transparent text-[var(--color-fg-muted)] transition hover:border-[var(--color-rose)]/40 hover:bg-[var(--color-rose)]/10 hover:text-[var(--color-rose)]"
              title="Güzergahı sil"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      <div className="mx-6 mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-[var(--color-border)] sm:mx-8">
        <Cell label="Günlük" value={fmtTL(profileDay)} />
        <Cell label="Çarpan" value={`× ${p.days}`} />
        <Cell label="Aylık" value={fmtTL(profileMon)} accentColor={accent} />
      </div>

      <div className="space-y-5 px-6 pb-6 sm:px-8 sm:pb-8">
        {(["going", "returning"] as const).map((dir) => (
          <TripBlock
            key={dir}
            dir={dir}
            legs={p[dir]}
            total={dir === "going" ? legsTotalGoing : legsTotalReturning}
            onAdd={() => addLeg(pi, dir)}
            onRemove={(id) => removeLeg(pi, dir, id)}
            onUpdate={(id, key, val) => updateLeg(pi, dir, id, key, val)}
          />
        ))}
      </div>
    </article>
  );
}

function Cell({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: string;
  accentColor?: string;
}) {
  return (
    <div className="bg-[var(--color-surface-2)] px-5 py-4">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.25em] text-[var(--color-fg-dim)]">
        {label}
      </p>
      <p
        className="mt-1.5 text-lg font-medium tabular-nums tracking-tight sm:text-xl"
        style={accentColor ? { color: accentColor } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

/* ───────────────────────── Trip block ───────────────────────── */
function TripBlock({
  dir,
  legs,
  total,
  onAdd,
  onRemove,
  onUpdate,
}: {
  dir: "going" | "returning";
  legs: Leg[];
  total: number;
  onAdd: () => void;
  onRemove: (id: number) => void;
  onUpdate: <K extends keyof Leg>(id: number, key: K, val: Leg[K]) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-2)]/60 p-4 sm:p-5">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={
              "grid size-7 place-items-center rounded-lg text-xs " +
              (dir === "going"
                ? "bg-[var(--color-lime-soft)] text-[var(--color-lime)]"
                : "bg-white/5 text-[var(--color-fg-muted)]")
            }
          >
            {dir === "going" ? "↗" : "↙"}
          </span>
          <span className="text-sm font-medium tracking-tight">
            {dir === "going" ? "Gidiş" : "Dönüş"}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
            {legs.length} bacak
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] tabular-nums text-[var(--color-fg-muted)]">
            {fmtTL(total)}
          </span>
          <button
            onClick={onAdd}
            className="rounded-full border border-[var(--color-border)] bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-[var(--color-fg-muted)] transition hover:border-[var(--color-lime)]/40 hover:bg-[var(--color-lime-soft)] hover:text-[var(--color-lime)]"
          >
            + bacak
          </button>
        </div>
      </header>

      <ol className="space-y-2">
        {legs.map((leg, idx) => (
          <li
            key={leg.id}
            className="group/leg grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-xl border border-transparent bg-white/[0.02] p-2 transition hover:border-[var(--color-border)] sm:grid-cols-[28px_minmax(0,1.6fr)_minmax(0,1fr)_auto_auto_auto]"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-white/5 font-mono text-[10px] tabular-nums text-[var(--color-fg-muted)]">
              {String(idx + 1).padStart(2, "0")}
            </span>

            <select
              value={leg.vIdx}
              onChange={(e) => onUpdate(leg.id, "vIdx", Number(e.target.value))}
              className="col-span-2 min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[13px] outline-none transition hover:border-[var(--color-border-strong)] focus:border-[var(--color-lime)]/40 sm:col-span-1"
            >
              {VEHICLES.map((v, i) => (
                <option key={i} value={i}>
                  {v.label} — {fmtTL(v.price)}
                </option>
              ))}
            </select>

            <input
              value={leg.label}
              onChange={(e) => onUpdate(leg.id, "label", e.target.value)}
              placeholder="hat (62G, M4…)"
              className="col-span-2 min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[12px] text-[var(--color-fg-muted)] outline-none transition placeholder:text-[var(--color-fg-dim)]/60 hover:border-[var(--color-border-strong)] focus:border-[var(--color-fg-muted)] focus:text-[var(--color-fg)] sm:col-span-1"
            />

            <button
              onClick={() => onUpdate(leg.id, "isTransfer", !leg.isTransfer)}
              className={
                "col-span-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium transition sm:col-span-1 " +
                (leg.isTransfer
                  ? "bg-[var(--color-lime-soft)] text-[var(--color-lime)] ring-1 ring-[var(--color-lime)]/30"
                  : "bg-white/5 text-[var(--color-fg-muted)] hover:bg-white/10 hover:text-[var(--color-fg)]")
              }
            >
              {leg.isTransfer ? "✶ aktarmalı" : "aktarmasız"}
            </button>

            <span className="font-mono text-[12px] tabular-nums text-[var(--color-fg)]">
              {fmtTL(VEHICLES[leg.vIdx].price)}
            </span>

            <button
              onClick={() => legs.length > 1 && onRemove(leg.id)}
              disabled={legs.length <= 1}
              className="size-7 rounded-lg text-[var(--color-fg-dim)] transition hover:bg-[var(--color-rose)]/10 hover:text-[var(--color-rose)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--color-fg-dim)]"
            >
              ✕
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
