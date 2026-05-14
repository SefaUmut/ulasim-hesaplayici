"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

// Aktarma indirim sırası: 1., 2., 3., 4., 5. aktarma fiyatları
const AKTARMA_PRICES = [31.27, 24.02, 15.62, 15.62, 15.62];

// Bir bacak listesi için her bacağın gerçek (efektif) fiyatını döner.
// İBB kuralı:
//   • Otobüs / metro / tramvay "aktarmalı" işaretliyse → AKTARMA_PRICES tarifesinden sıra
//     (1.→31,27 / 2.→24,02 / 3-5.→15,62) ve aktarma sayacı bir artar.
//   • Metrobüs "aktarmalı" olsa da kendi durak fiyatından ödenir, sayaç ETKİLENMEZ.
//   • Marmaray / Vapur de kendi fiyatından ödenir, sayaç etkilenmez.
function computeLegPrices(legs: { vIdx: number; isTransfer: boolean }[]): number[] {
  let aktarmaCount = 0;
  return legs.map((l, idx) => {
    const v = VEHICLES[l.vIdx];
    const eligibleForAktarma =
      idx > 0 &&
      !v.label.startsWith("Metrobüs") &&
      !v.label.startsWith("Marmaray") &&
      !v.label.startsWith("Vapur");

    if (l.isTransfer && eligibleForAktarma) {
      const price = AKTARMA_PRICES[Math.min(aktarmaCount, AKTARMA_PRICES.length - 1)];
      aktarmaCount++;
      return price;
    }
    return v.price;
  });
}

const MONTHS_TR = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

const VEHICLES = [
  { label: "Otobüs / Metro / Tramvay", short: "Otobüs · Metro · Tramvay", icon: "◆", price: 42.0 },
  // Metrobüs durak kademeleri — kullanıcı iade almadığı için dropdown'dan gizli; eski kayıtlar için indeksler korunuyor.
  { label: "Metrobüs · 1 durak", short: "Metrobüs 1", icon: "▶", price: 30.07, hidden: true },
  { label: "Metrobüs · 2 durak", short: "Metrobüs 2", icon: "▶", price: 35.97, hidden: true },
  { label: "Metrobüs · 3 durak", short: "Metrobüs 3", icon: "▶", price: 42.0, hidden: true },
  { label: "Metrobüs · 4–9 durak", short: "Metrobüs 4–9", icon: "▶▶", price: 48.01, hidden: true },
  { label: "Metrobüs · 10–15 durak", short: "Metrobüs 10–15", icon: "▶▶", price: 52.73, hidden: true },
  { label: "Metrobüs · 16–21 durak", short: "Metrobüs 16–21", icon: "▶▶", price: 55.17, hidden: true },
  { label: "Metrobüs · 22–27 durak", short: "Metrobüs 22–27", icon: "▶▶", price: 56.97, hidden: true },
  { label: "Metrobüs · 28–33 durak", short: "Metrobüs 28–33", icon: "▶▶▶", price: 58.87, hidden: true },
  { label: "Metrobüs", short: "Metrobüs", icon: "▶▶▶", price: 62.35 },
  { label: "Marmaray · 1–7 durak", short: "Marmaray 1–7", icon: "═", price: 34.0, hidden: true },
  { label: "Vapur — Kadıköy / Eminönü", short: "Vapur", icon: "≈", price: 59.28 },
  // Manuel aktarma kalemleri — dropdown'dan gizli, sadece eski data ile uyumluluk için tutuluyor.
  { label: "1. aktarma indirimi", short: "1. aktarma", icon: "↻", price: 31.27, aktarma: true },
  { label: "2. aktarma indirimi", short: "2. aktarma", icon: "↻↻", price: 24.02, aktarma: true },
  { label: "3. aktarma indirimi", short: "3. aktarma", icon: "↻↻↻", price: 15.62, aktarma: true },
  { label: "4. aktarma indirimi", short: "4. aktarma", icon: "↻↻↻", price: 15.62, aktarma: true },
  { label: "5. aktarma indirimi", short: "5. aktarma", icon: "↻↻↻", price: 15.62, aktarma: true },
  // Marmaray kademeleri — iade alınmadığı için dropdown'da tek görünür opsiyon var; diğerleri eski kayıtlar için tutuluyor.
  { label: "Marmaray · 8–14 durak", short: "Marmaray 8–14", icon: "══", price: 43.4, hidden: true },
  { label: "Marmaray · 15–21 durak", short: "Marmaray 15–21", icon: "══", price: 50.1, hidden: true },
  { label: "Marmaray · 22–28 durak", short: "Marmaray 22–28", icon: "═══", price: 57.78, hidden: true },
  { label: "Marmaray", short: "Marmaray", icon: "═══", price: 67.49 },
  { label: "Marmaray · 36–43 durak", short: "Marmaray 36–43", icon: "═══", price: 74.7, hidden: true },
];

const fmt = (n: number) =>
  n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTL = (n: number) => `${fmt(n)} ₺`;

type Leg = { id: number; vIdx: number; label: string; isTransfer: boolean };
type Profile = { name: string; days: number; going: Leg[]; returning: Leg[] };

let uid = 1;
const newLeg = (vIdx = 0): Leg => ({ id: uid++, vIdx, label: "", isTransfer: false });

// Standart güzergah template — yeni aya geçildiğinde de bu uygulanır.
// vIdx 0 = Otobüs/Metro/Tramvay, vIdx 4 = Metrobüs 4-9 durak (5 durak için)
const STANDARD_WORKDAYS = 22;

const buildStandardTemplate = (): Profile => ({
  name: "Standart güzergah",
  days: STANDARD_WORKDAYS,
  going: [
    { id: uid++, vIdx: 0, label: "62 / 62G", isTransfer: false },
    { id: uid++, vIdx: 9, label: "Metrobüs (Zincirlikuyu — Uzunçayır)", isTransfer: true },
    { id: uid++, vIdx: 0, label: "M4 Metro", isTransfer: true },
    { id: uid++, vIdx: 0, label: "14BK / 20E / 20Ü", isTransfer: true },
  ],
  returning: [
    { id: uid++, vIdx: 0, label: "14BK / 20E / 20Ü", isTransfer: false },
    { id: uid++, vIdx: 9, label: "Metrobüs (Zincirlikuyu — Uzunçayır)", isTransfer: true },
    { id: uid++, vIdx: 0, label: "62 / 62G", isTransfer: true },
  ],
});

const defaultStandard: Profile = buildStandardTemplate();

// Hazır müşteri güzergahları — dropdown'dan seçilince yeni profil olarak eklenir.
type PresetLeg = { vIdx: number; label: string; isTransfer: boolean };
type CustomerPreset = { key: string; name: string; days: number; going: PresetLeg[]; returning: PresetLeg[] };
const CUSTOMER_PRESETS: CustomerPreset[] = [
  {
    key: "cetas",
    name: "CETAS",
    days: 1,
    going: [
      { vIdx: 0, label: "M2 Metro", isTransfer: false },
      { vIdx: 20, label: "Marmaray — Yenikapı", isTransfer: false },
      { vIdx: 0, label: "M9 Metro", isTransfer: true },
    ],
    returning: [
      { vIdx: 0, label: "M9 Metro", isTransfer: false },
      { vIdx: 20, label: "Marmaray — Ataköy", isTransfer: false },
      { vIdx: 0, label: "M2 Metro", isTransfer: true },
    ],
  },
];

const buildFromPreset = (p: CustomerPreset): Profile => ({
  name: p.name,
  days: p.days,
  going: p.going.map((l) => ({ id: uid++, vIdx: l.vIdx, label: l.label, isTransfer: l.isTransfer })),
  returning: p.returning.map((l) => ({ id: uid++, vIdx: l.vIdx, label: l.label, isTransfer: l.isTransfer })),
});

export default function UlasimHesaplayici() {
  const [profiles, setProfiles] = useState<Profile[]>([defaultStandard]);
  const [totalWorkdays, setTotalWorkdays] = useState(22);
  const [senderName, setSenderName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const now0 = new Date();
  const [periodMonth, setPeriodMonth] = useState(now0.getMonth());
  const [periodYear, setPeriodYear] = useState(now0.getFullYear());
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [tarifeOpen, setTarifeOpen] = useState(false);

  // Auth & sync state
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [authSending, setAuthSending] = useState(false);
  const [authMsg, setAuthMsg] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [syncState, setSyncState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const shapeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monthTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loadToken = useRef(0);

  type HistoryRow = {
    year: number;
    month: number;
    total_workdays: number;
    profile_days: number[];
    profiles: Profile[] | null;
    monthly_total: number | null;
    updated_at: string;
  };
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const fetchHistory = async (uid: string) => {
    const { data } = await supabase
      .from("monthly_entries")
      .select("year, month, total_workdays, profile_days, profiles, monthly_total, updated_at")
      .eq("user_id", uid)
      .order("year", { ascending: false })
      .order("month", { ascending: false });
    if (data) setHistory(data as HistoryRow[]);
  };

  const [pendingCopy, setPendingCopy] = useState<string | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpand = (pi: number) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(pi)) n.delete(pi);
      else n.add(pi);
      return n;
    });
  const [showHistory, setShowHistory] = useState(false);

  const requestCopy = (h: HistoryRow) => {
    const key = `${h.year}-${h.month}`;
    if (pendingCopy === key) {
      setTotalWorkdays(h.total_workdays);
      if (h.profiles && h.profiles.length > 0) {
        // New format — clone the full profile list (shapes + days) with fresh leg ids
        const cloned = h.profiles.map((p) => ({
          ...p,
          going: p.going.map((l) => ({ ...l, id: uid++ })),
          returning: p.returning.map((l) => ({ ...l, id: uid++ })),
        }));
        setProfiles(cloned);
      } else {
        // Legacy fallback — only days
        setProfiles((prev) =>
          prev.map((p, i) => ({ ...p, days: h.profile_days[i] ?? 0 })),
        );
      }
      setPendingCopy(null);
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    } else {
      setPendingCopy(key);
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      pendingTimer.current = setTimeout(() => setPendingCopy(null), 3000);
    }
  };

  const deleteMonth = async (year: number, month: number) => {
    if (!session) return;
    if (!confirm(`${MONTHS_TR[month]} ${year} kaydını silmek istediğine emin misin?`)) return;
    await supabase
      .from("monthly_entries")
      .delete()
      .eq("user_id", session.user.id)
      .eq("year", year)
      .eq("month", month);
    setHistory((h) => h.filter((r) => !(r.year === year && r.month === month)));
  };

  const shiftPeriod = (delta: number) => {
    const d = new Date(periodYear, periodMonth + delta, 1);
    setPeriodMonth(d.getMonth());
    setPeriodYear(d.getFullYear());
  };

  // Save A — profile SHAPES + sender/company → user_data
  useEffect(() => {
    if (!hydrated || !session) return;
    setSyncState("saving");
    if (shapeTimer.current) clearTimeout(shapeTimer.current);
    shapeTimer.current = setTimeout(async () => {
      const shapes = profiles.map((p) => ({
        name: p.name,
        going: p.going,
        returning: p.returning,
      }));
      const { error } = await supabase.from("user_data").upsert({
        user_id: session.user.id,
        data: { profiles: shapes, senderName, companyName },
        updated_at: new Date().toISOString(),
      });
      setSyncState(error ? "error" : "saved");
    }, 300);
  }, [profiles, senderName, companyName, hydrated, session]);

  // Save B — monthly entry (totalWorkdays + profile_days[] + snapshot total) → monthly_entries
  useEffect(() => {
    if (!hydrated || !session) return;
    const periodKey = `${periodYear}-${periodMonth}`;
    // Yüklü olan ay, şu anki ayla eşleşmiyorsa kayıt yapma — profil verisi eski aydan kalma olabilir.
    if (loadedKey !== periodKey) {
      if (monthTimer.current) clearTimeout(monthTimer.current);
      return;
    }
    if (monthLoading) {
      if (monthTimer.current) clearTimeout(monthTimer.current);
      return;
    }
    const targetYear = periodYear;
    const targetMonth = periodMonth;
    setSyncState("saving");
    if (monthTimer.current) clearTimeout(monthTimer.current);
    monthTimer.current = setTimeout(async () => {
      // Final guard: period must still match
      if (targetYear !== periodYear || targetMonth !== periodMonth) return;

      const profile_days = profiles.map((p) => Number(p.days) || 0);
      const monthly_total = profiles.reduce(
        (sum, p, i) =>
          sum +
          (legsTotal(p.going) + legsTotal(p.returning)) * (profile_days[i] || 0),
        0,
      );
      const { error } = await supabase.from("monthly_entries").upsert({
        user_id: session.user.id,
        year: targetYear,
        month: targetMonth,
        total_workdays: totalWorkdays,
        profile_days,
        profiles, // full shape (name + legs + days) — per-month, independent
        monthly_total,
        updated_at: new Date().toISOString(),
      });
      setSyncState(error ? "error" : "saved");
      if (!error) fetchHistory(session.user.id);
    }, 300);
  }, [profiles, totalWorkdays, periodMonth, periodYear, hydrated, session, monthLoading, loadedKey]);

  // Pending save uyarısı — kullanıcı kaydedilmeden sekmeyi kapatmaya kalkarsa onay sor.
  useEffect(() => {
    if (syncState !== "saving") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [syncState]);

  // Subscribe to auth changes. Auto-open login if no session.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
      if (!data.session) setHydrated(true); // modal otomatik açılır, app gizli
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // When signed in, pull profile shapes + sender/company from user_data
  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data, error } = await supabase
        .from("user_data")
        .select("data")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (error) {
        setSyncState("error");
        setHydrated(true);
        return;
      }
      if (data?.data) {
        const cloud = data.data as Record<string, unknown>;
        if (Array.isArray(cloud.profiles)) {
          const shapes = cloud.profiles as Array<Omit<Profile, "id" | "days"> & { days?: number }>;
          setProfiles(
            shapes.map((s) => ({
              name: s.name,
              going: s.going,
              returning: s.returning,
              days: 0, // overwritten by monthly fetch
            })),
          );
        }
        if (typeof cloud.senderName === "string") setSenderName(cloud.senderName);
        if (typeof cloud.companyName === "string") setCompanyName(cloud.companyName);
        setSyncState("saved");
      } else {
        // First time: seed user_data with current shapes
        await supabase.from("user_data").upsert({
          user_id: session.user.id,
          data: {
            profiles: profiles.map((p) => ({
              name: p.name,
              going: p.going,
              returning: p.returning,
            })),
            senderName,
            companyName,
          },
        });
        setSyncState("saved");
      }
      setHydrated(true);
      fetchHistory(session.user.id);
    })();
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load monthly entry whenever session/period changes
  useEffect(() => {
    if (!session || !hydrated) return;
    setMonthLoading(true);
    const token = ++loadToken.current;
    const targetYear = periodYear;
    const targetMonth = periodMonth;
    (async () => {
      const { data } = await supabase
        .from("monthly_entries")
        .select("total_workdays, profile_days, profiles")
        .eq("user_id", session.user.id)
        .eq("year", targetYear)
        .eq("month", targetMonth)
        .maybeSingle();

      // Eski/iptal edilmiş fetch — kullanıcı bu süre içinde başka aya geçti
      if (token !== loadToken.current) return;

      // Apply a row to local state. Prefer new-format profiles; fall back to
      // overlaying days on currently loaded shapes (legacy rows).
      const applyRow = (row: { total_workdays: number; profile_days: number[] | null; profiles: Profile[] | null }) => {
        setTotalWorkdays(row.total_workdays);
        const fullProfiles = Array.isArray(row.profiles) && row.profiles.length > 0 ? row.profiles : null;
        if (fullProfiles) {
          // Re-issue stable leg ids in case stored ids collide with uid counter
          const reissued = fullProfiles.map((p) => ({
            ...p,
            going: p.going.map((l) => ({ ...l, id: uid++ })),
            returning: p.returning.map((l) => ({ ...l, id: uid++ })),
          }));
          setProfiles(reissued);
        } else if (row.profile_days) {
          setProfiles((prev) => prev.map((p, i) => ({ ...p, days: row.profile_days![i] ?? 0 })));
        }
      };

      if (data) {
        applyRow(data as { total_workdays: number; profile_days: number[] | null; profiles: Profile[] | null });
      } else {
        // No entry for this period — start with the Standart güzergah template
        setTotalWorkdays(STANDARD_WORKDAYS);
        setProfiles([buildStandardTemplate()]);
      }
      setMonthLoading(false);
      setLoadedKey(`${targetYear}-${targetMonth}`);
    })();
  }, [session, hydrated, periodMonth, periodYear]);

  const submitAuth = async () => {
    const email = process.env.NEXT_PUBLIC_AUTH_EMAIL || "";
    const password = authPassword;
    if (!password) return;
    if (!email) {
      setAuthMsg("Hata: yapılandırma eksik (auth email tanımlı değil).");
      return;
    }
    setAuthSending(true);
    setAuthMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthSending(false);
    if (error) setAuthMsg(`Hata: ${error.message}`);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    // Reset to defaults — nothing persists locally
    setProfiles([buildStandardTemplate()]);
    setTotalWorkdays(22);
    setSenderName("");
    setCompanyName("");
    const n = new Date();
    setPeriodMonth(n.getMonth());
    setPeriodYear(n.getFullYear());
  };

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

  const addPreset = (key: string) => {
    const preset = CUSTOMER_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    setProfiles((p) => [...p, buildFromPreset(preset)]);
  };

  const removeProfile = (pi: number) => setProfiles((p) => p.filter((_, i) => i !== pi));

  const duplicateProfile = (pi: number) => {
    const src = profiles[pi];
    const input = window.prompt(
      `"${src.name}" kopyalanıyor.\n\nMüşteri adı (boş bırakırsan otomatik isim verilir):`,
      "",
    );
    if (input === null) return; // user cancelled
    const newName = input.trim() ? input.trim() : `${src.name} (kopya)`;
    setProfiles((p) => {
      const s = p[pi];
      const clone: Profile = {
        name: newName,
        days: s.days,
        going: s.going.map((l) => ({ ...l, id: uid++ })),
        returning: s.returning.map((l) => ({ ...l, id: uid++ })),
      };
      const next = [...p];
      next.splice(pi + 1, 0, clone);
      return next;
    });
  };

  const legsTotal = (legs: Leg[]) =>
    computeLegPrices(legs).reduce((s, p) => s + p, 0);
  const profileDay = (p: Profile) => legsTotal(p.going) + legsTotal(p.returning);
  const profileMon = (p: Profile) => profileDay(p) * (Number(p.days) || 0);
  const grandTotal = profiles.reduce((s, p) => s + profileMon(p), 0);
  const assignedDays = profiles.reduce((s, p) => s + (Number(p.days) || 0), 0);

  const reqText = () => {
    const today = new Date().toLocaleDateString("tr-TR");
    const period = `${MONTHS_TR[periodMonth]} ${periodYear}`;
    const lines = profiles
      .map((p) => {
        const legLines = (legs: Leg[]) => {
          const prices = computeLegPrices(legs);
          return legs
            .map((l, i) => {
              const vName = VEHICLES[l.vIdx].label;
              const hat = l.label ? ` (${l.label})` : "";
              const tag = l.isTransfer ? " [aktarma]" : "";
              return `    • ${vName}${hat}${tag} — ${fmtTL(prices[i])}`;
            })
            .join("\n");
        };

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

    const recipient = companyName.trim()
      ? `${companyName.trim()} — İlgili Departmana,`
      : `İlgili departmana,`;
    const signature = senderName.trim()
      ? `Saygılarımla,\n${senderName.trim()}`
      : `Saygılarımla.`;

    return [
      `Konu: ${period} dönemi ulaşım ücreti talebi`,
      `Tarih: ${today}`,
      ``,
      recipient,
      ``,
      `${period} dönemine ait toplu taşıma ulaşım giderime ilişkin ücret talebimi bilgilerinize sunarım.`,
      ``,
      lines,
      ``,
      `${"─".repeat(42)}`,
      `Toplam çalışma günü : ${totalWorkdays} gün`,
      `Aylık genel toplam  : ${fmtTL(grandTotal)}`,
      ``,
      `${fmtTL(grandTotal)} tutarının tarafıma ödenmesini rica ederim.`,
      ``,
      signature,
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
    <main className="mx-auto min-h-dvh max-w-2xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10 lg:max-w-3xl">
      {/* Header */}
      <header className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[28px] leading-none tracking-tight sm:text-[34px]">
          Ulaşım <span className="italic text-[var(--color-lime)]">defteri</span>
        </h1>
        {session ? (
          <button
            onClick={signOut}
            className="chip transition hover:border-[var(--color-border-strong)]"
            title={`Çıkış · ${session.user.email}`}
          >
            <span
              className={
                "size-1.5 rounded-full " +
                (syncState === "saving"
                  ? "bg-[var(--color-sky)]"
                  : syncState === "error"
                  ? "bg-[var(--color-rose)]"
                  : "bg-[var(--color-lime)]")
              }
            />
            <span>
              {syncState === "saving"
                ? "kaydediliyor"
                : syncState === "error"
                ? "hata"
                : "senkron"}
            </span>
          </button>
        ) : null}
      </header>

      {/* Period + Total bar */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-surface-2)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
        <div className="pointer-events-none absolute -right-24 -top-20 size-[280px] rounded-full bg-[var(--color-lime)] opacity-[0.08] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-20 size-[220px] rounded-full bg-[var(--color-violet)] opacity-[0.06] blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftPeriod(-1)}
              className="grid size-8 place-items-center rounded-lg text-[var(--color-fg-muted)] transition hover:bg-white/5 hover:text-[var(--color-fg)]"
              aria-label="Önceki ay"
            >
              ‹
            </button>
            <div className="min-w-[110px] px-1 text-center">
              <p className="font-display text-[20px] italic leading-none tracking-tight">
                {MONTHS_TR[periodMonth]}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-fg-dim)]">
                {periodYear}
              </p>
            </div>
            <button
              onClick={() => shiftPeriod(1)}
              className="grid size-8 place-items-center rounded-lg text-[var(--color-fg-muted)] transition hover:bg-white/5 hover:text-[var(--color-fg)]"
              aria-label="Sonraki ay"
            >
              ›
            </button>
          </div>
          <div className="text-right">
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-fg-dim)]">
              <span className="size-1 rounded-full bg-[var(--color-lime)] shadow-[0_0_8px_var(--color-lime)]" />
              Aylık toplam
            </p>
            <p
              className="mt-1 font-display text-[42px] leading-none tracking-tight tabular-nums sm:text-[52px]"
              style={{
                background:
                  "linear-gradient(180deg, var(--color-lime) 0%, color-mix(in srgb, var(--color-lime) 75%, transparent) 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                textShadow: "0 8px 32px rgba(214,255,61,0.18)",
              }}
            >
              {fmt(grandTotal)}
              <span className="ml-1 align-top text-lg font-normal text-[var(--color-fg-muted)]" style={{ WebkitTextFillColor: "var(--color-fg-muted)" }}>₺</span>
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--color-fg-muted)]">
            <span>Çalışma günü</span>
            {(() => {
              const diff = totalWorkdays - assignedDays;
              if (diff === 0) return null;
              if (diff > 0) {
                return (
                  <button
                    onClick={() => {
                      // Eksik günleri ilk profile ekle
                      setProfiles((p) =>
                        p.map((x, i) =>
                          i === 0 ? { ...x, days: Number(x.days) + diff } : x,
                        ),
                      );
                    }}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--color-sky)]/10 px-2.5 py-0.5 font-mono text-[10px] text-[var(--color-sky)] transition hover:bg-[var(--color-sky)]/20"
                    title={`${diff} günü ilk güzergaha ekle`}
                  >
                    {diff} gün boşta · ekle
                  </button>
                );
              }
              return (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-rose)]/10 px-2.5 py-0.5 font-mono text-[10px] text-[var(--color-rose)]">
                  ⚠ {Math.abs(diff)} gün fazla
                </span>
              );
            })()}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] p-0.5">
            <button
              onClick={() => setTotalWorkdays((d) => Math.max(1, d - 1))}
              className="grid size-7 place-items-center rounded-md text-[var(--color-fg-muted)] transition hover:bg-white/5 hover:text-[var(--color-fg)]"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={31}
              value={totalWorkdays}
              onChange={(e) => setTotalWorkdays(Number(e.target.value) || 1)}
              className="w-10 bg-transparent text-center text-sm font-medium tabular-nums outline-none"
            />
            <button
              onClick={() => setTotalWorkdays((d) => Math.min(31, d + 1))}
              className="grid size-7 place-items-center rounded-md text-[var(--color-fg-muted)] transition hover:bg-white/5 hover:text-[var(--color-fg)]"
            >
              +
            </button>
          </div>
        </div>
      </section>

      {/* History — collapsible compact (active month hariç) */}
      {session && (() => {
        const pastMonths = history.filter(
          (h) => !(h.year === periodYear && h.month === periodMonth),
        );
        if (pastMonths.length === 0) return null;
        return (
        <section className="mt-3">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] text-[var(--color-fg-muted)] transition hover:bg-white/5"
          >
            <span className="inline-flex items-center gap-2">
              <span>{showHistory ? "▾" : "▸"}</span>
              <span>Geçmiş aylar</span>
              <span className="font-mono text-[10px] text-[var(--color-fg-dim)]">
                · {pastMonths.length}
              </span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-fg-dim)]">
              {showHistory ? "kapat" : "göster"}
            </span>
          </button>

          {showHistory && (
            <ul className="mt-2 space-y-1.5">
              {pastMonths.map((h) => {
                const isActive = false; // active month is filtered out above
                const monthTotal =
                  h.monthly_total != null
                    ? Number(h.monthly_total)
                    : (h.profiles ?? []).reduce(
                        (sum, p) =>
                          sum +
                          (legsTotal(p.going) + legsTotal(p.returning)) *
                            (Number(p.days) || 0),
                        0,
                      ) ||
                      h.profile_days.reduce((sum, d, i) => {
                        const p = profiles[i];
                        if (!p) return sum;
                        const day = legsTotal(p.going) + legsTotal(p.returning);
                        return sum + day * (d || 0);
                      }, 0);
                const pending = pendingCopy === `${h.year}-${h.month}`;
                return (
                  <li
                    key={`${h.year}-${h.month}`}
                    className={
                      "group/h flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition " +
                      (isActive
                        ? "border-[var(--color-lime)]/40 bg-[var(--color-lime-soft)]"
                        : "border-[var(--color-border)] bg-[var(--color-bg-2)]/40 hover:border-[var(--color-border-strong)]")
                    }
                  >
                    <button
                      onClick={() => {
                        setPeriodMonth(h.month);
                        setPeriodYear(h.year);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span
                        className={
                          "w-12 shrink-0 font-mono text-[10px] uppercase tracking-wider " +
                          (isActive ? "text-[var(--color-lime)]" : "text-[var(--color-fg-muted)]")
                        }
                      >
                        {MONTHS_TR[h.month].slice(0, 3)} {String(h.year).slice(2)}
                      </span>
                      <span className="flex-1 font-mono text-[11px] text-[var(--color-fg-dim)]">
                        {h.total_workdays} gün
                      </span>
                      <span className="font-mono text-[13px] tabular-nums text-[var(--color-fg)]">
                        {fmtTL(monthTotal)}
                      </span>
                    </button>
                    <div className="flex items-center gap-1">
                      {!isActive && (
                        <button
                          onClick={() => requestCopy(h)}
                          className={
                            "rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] transition " +
                            (pending
                              ? "bg-[var(--color-lime)] text-[#0a0a0c]"
                              : "text-[var(--color-fg-muted)] hover:bg-white/10 hover:text-[var(--color-lime)]")
                          }
                          title={`${MONTHS_TR[h.month]} ${h.year}'ı şu anki aya kopyala`}
                        >
                          {pending ? "onayla" : "kopyala"}
                        </button>
                      )}
                      <button
                        onClick={() => deleteMonth(h.year, h.month)}
                        className="grid size-6 place-items-center rounded text-[var(--color-fg-muted)] transition hover:bg-[var(--color-rose)]/10 hover:text-[var(--color-rose)]"
                        aria-label="Sil"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        );
      })()}

      {/* Profiles */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-3 px-1">
          <h2 className="font-display text-xl italic tracking-tight text-[var(--color-fg)]">
            Güzergahlar
          </h2>
          <span className="h-px flex-1 bg-gradient-to-r from-[var(--color-border)] to-transparent" />
        </div>
        <ul className="space-y-2">
          {profiles.map((p, pi) => (
            <ProfileRow
              key={pi}
              p={p}
              pi={pi}
              isOpen={expanded.has(pi)}
              canRemove={profiles.length > 1}
              monthCost={profileMon(p)}
              legsTotalGoing={legsTotal(p.going)}
              legsTotalReturning={legsTotal(p.returning)}
              onToggle={() => toggleExpand(pi)}
              updateProfile={updateProfile}
              updateLeg={updateLeg}
              addLeg={addLeg}
              removeLeg={removeLeg}
              removeProfile={removeProfile}
              duplicateProfile={duplicateProfile}
            />
          ))}
        </ul>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={addProfile}
            className="group inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] bg-gradient-to-b from-transparent to-white/[0.01] py-3 text-[13px] text-[var(--color-fg-muted)] transition-all hover:border-[var(--color-lime)]/40 hover:bg-[var(--color-lime-soft)] hover:text-[var(--color-lime)]"
          >
            <span className="grid size-5 place-items-center rounded-full border border-current text-[11px] transition group-hover:bg-[var(--color-lime)]/15">
              +
            </span>
            Boş güzergah ekle
          </button>
          <PresetSelect onPick={addPreset} />
        </div>
      </section>

      {/* Sender / Company — compact */}
      <section className="mt-8 grid gap-3 sm:grid-cols-2">
        <label className="group/in relative block">
          <span className="pointer-events-none absolute left-4 top-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
            Adınız
          </span>
          <input
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Ad Soyad"
            className="peer w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 pb-2.5 pt-5 text-[14px] outline-none transition placeholder:text-[var(--color-fg-dim)]/60 hover:border-[var(--color-border-strong)] focus:border-[var(--color-lime)]/50 focus:ring-2 focus:ring-[var(--color-lime)]/15"
          />
        </label>
        <label className="group/in relative block">
          <span className="pointer-events-none absolute left-4 top-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
            Şirket
          </span>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Şirket adı"
            className="peer w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 pb-2.5 pt-5 text-[14px] outline-none transition placeholder:text-[var(--color-fg-dim)]/60 hover:border-[var(--color-border-strong)] focus:border-[var(--color-lime)]/50 focus:ring-2 focus:ring-[var(--color-lime)]/15"
          />
        </label>
      </section>

      {/* Request letter */}
      <section className="mt-4">
        <details className="group rounded-xl border border-[var(--color-border)] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-surface-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:border-[var(--color-border-strong)]">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2.5">
              <span className="grid size-5 place-items-center rounded-md bg-white/5 text-[var(--color-fg-muted)] transition group-open:rotate-90 group-open:bg-[var(--color-lime-soft)] group-open:text-[var(--color-lime)]">▸</span>
              Talep metnini gör & kopyala
            </span>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                copyText();
              }}
              className={
                "grid size-8 place-items-center rounded-full transition-all " +
                (copied
                  ? "bg-[var(--color-lime)] text-[#0a0a0c] shadow-[0_0_0_1px_rgba(214,255,61,0.3),0_8px_24px_-8px_rgba(214,255,61,0.5)]"
                  : "bg-[var(--color-fg)] text-[#0a0a0c] hover:bg-[var(--color-lime)] hover:shadow-[0_0_0_1px_rgba(214,255,61,0.3),0_8px_24px_-8px_rgba(214,255,61,0.5)]")
              }
              title={copied ? "Kopyalandı" : "Kopyala"}
              aria-label={copied ? "Kopyalandı" : "Kopyala"}
            >
              {copied ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
            </button>
          </summary>
          <textarea
            readOnly
            value={reqText()}
            rows={14}
            className="block w-full resize-y border-t border-[var(--color-border)] bg-[var(--color-bg-2)] p-4 font-mono text-[12px] leading-[1.8] text-[var(--color-fg)] outline-none"
          />
        </details>
      </section>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-5 text-[11px] text-[var(--color-fg-dim)]">
        <button
          onClick={() => setTarifeOpen(true)}
          className="inline-flex items-center gap-2 font-mono uppercase tracking-[0.18em] transition hover:text-[var(--color-lime)]"
        >
          <span>ⓘ</span>
          Tarife · İBB UKOME 16.02.2026
        </button>
        <span className="font-display italic text-[var(--color-fg-muted)]">fin.</span>
      </footer>

      {recoveryMode && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-fg-dim)]">
              Şifre sıfırlama
            </p>
            <h3 className="mt-2 font-display text-[36px] leading-none tracking-tight">
              Yeni <span className="italic text-[var(--color-lime)]">anahtar</span>
            </h3>
            <p className="mt-4 text-[13.5px] leading-relaxed text-[var(--color-fg-muted)]">
              Yeni anahtarını belirle ve devam et.
            </p>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (newPassword.length < 6) return;
                setAuthSending(true);
                const { error } = await supabase.auth.updateUser({ password: newPassword });
                setAuthSending(false);
                if (error) {
                  setAuthMsg(`Hata: ${error.message}`);
                  return;
                }
                setNewPassword("");
                setAuthMsg(null);
                setRecoveryMode(false);
                window.history.replaceState(null, "", window.location.pathname);
              }}
              className="mt-6 space-y-3"
            >
              <label className="relative block">
                <span className="pointer-events-none absolute left-4 top-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
                  Yeni anahtar
                </span>
                <input
                  type="password"
                  required
                  autoFocus
                  minLength={6}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="en az 6 karakter"
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-4 pb-3 pt-6 text-[14px] outline-none transition placeholder:text-[var(--color-fg-dim)]/60 hover:border-[var(--color-border-strong)] focus:border-[var(--color-lime)]/50 focus:ring-2 focus:ring-[var(--color-lime)]/15"
                />
              </label>
              <button
                type="submit"
                disabled={authSending}
                className="relative w-full overflow-hidden rounded-xl bg-[var(--color-lime)] py-3.5 text-[14px] font-medium text-[#0a0a0c] shadow-[0_0_0_1px_rgba(214,255,61,0.25),0_10px_40px_-10px_rgba(214,255,61,0.4)] transition hover:shadow-[0_0_0_1px_rgba(214,255,61,0.45),0_10px_50px_-8px_rgba(214,255,61,0.55)] disabled:opacity-50"
              >
                {authSending ? "Güncelleniyor…" : "Anahtarı kaydet →"}
              </button>
            </form>

            {authMsg && (
              <p className="mt-4 rounded-xl border border-[var(--color-rose)]/30 bg-[var(--color-rose)]/10 p-3 text-[12.5px] text-[var(--color-rose)]">
                {authMsg}
              </p>
            )}
          </div>
        </div>
      )}

      {authChecked && !session && !recoveryMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-2xl"
          >
            <div className="pointer-events-none absolute -right-24 -top-24 size-[320px] rounded-full bg-[var(--color-lime)] opacity-[0.10] blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 size-[260px] rounded-full bg-[var(--color-violet)] opacity-[0.12] blur-3xl" />

            <div className="relative">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-fg-dim)]">
                Bulut senkron
              </p>
              <h3 className="mt-2 font-display text-[36px] leading-none tracking-tight">
                Tekrar <span className="italic text-[var(--color-lime)]">hoş geldin</span>
              </h3>
              <p className="mt-4 text-[13.5px] leading-relaxed text-[var(--color-fg-muted)]">
                Anahtarını gir, devam et.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitAuth();
                }}
                className="mt-6 space-y-3"
              >
                <label className="relative block">
                  <span className="pointer-events-none absolute left-4 top-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
                    Anahtar
                  </span>
                  <input
                    type="password"
                    required
                    autoFocus
                    minLength={6}
                    autoComplete="current-password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-4 pb-3 pt-6 text-[14px] outline-none transition placeholder:text-[var(--color-fg-dim)]/60 hover:border-[var(--color-border-strong)] focus:border-[var(--color-lime)]/50 focus:ring-2 focus:ring-[var(--color-lime)]/15"
                  />
                </label>

                <button
                  type="submit"
                  disabled={authSending}
                  className="group/btn relative w-full overflow-hidden rounded-xl bg-[var(--color-lime)] py-3.5 text-[14px] font-medium text-[#0a0a0c] shadow-[0_0_0_1px_rgba(214,255,61,0.25),0_10px_40px_-10px_rgba(214,255,61,0.4)] transition hover:shadow-[0_0_0_1px_rgba(214,255,61,0.45),0_10px_50px_-8px_rgba(214,255,61,0.55)] disabled:opacity-50"
                >
                  <span className="relative inline-flex items-center gap-2">
                    {authSending ? "Giriş yapılıyor…" : "Giriş yap"}
                    {!authSending && <span>→</span>}
                  </span>
                </button>
              </form>

              {authMsg && (
                <p
                  className={
                    "mt-4 rounded-xl border p-3 text-[12.5px] " +
                    (authMsg.startsWith("✓")
                      ? "border-[var(--color-lime)]/30 bg-[var(--color-lime-soft)] text-[var(--color-lime)]"
                      : "border-[var(--color-rose)]/30 bg-[var(--color-rose)]/10 text-[var(--color-rose)]")
                  }
                >
                  {authMsg}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {tarifeOpen && (
        <div
          onClick={() => setTarifeOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-bg-2)] px-5 py-3">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[var(--color-fg-dim)]">
                  Kaynak görsel
                </p>
                <h3 className="mt-0.5 truncate font-display text-[18px] italic tracking-tight">
                  İBB UKOME · <span className="text-[var(--color-lime)]">16.02.2026</span>
                </h3>
              </div>
              <button
                onClick={() => setTarifeOpen(false)}
                className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--color-fg-muted)] transition hover:bg-white/5 hover:text-[var(--color-fg)]"
                aria-label="Kapat"
              >
                ✕
              </button>
            </header>
            <div className="space-y-3 overflow-auto p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/IETT Ulaşım Ücret Tarifesi.jpeg"
                alt="İBB UKOME 16.02.2026 ulaşım ücret tarifesi"
                className="block h-auto w-full rounded-xl"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Marmaray Ücretlendirme.jpeg"
                alt="Marmaray ücretlendirme tarifesi"
                className="block h-auto w-full rounded-xl"
              />
              <p className="text-center font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
                12.02.2026 · 263 sayılı meclis kararı
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ───────────────────────── Profile row (collapsed by default) ───────────────────────── */
function ProfileRow({
  p,
  pi,
  isOpen,
  canRemove,
  monthCost,
  legsTotalGoing,
  legsTotalReturning,
  onToggle,
  updateProfile,
  updateLeg,
  addLeg,
  removeLeg,
  removeProfile,
  duplicateProfile,
}: {
  p: Profile;
  pi: number;
  isOpen: boolean;
  canRemove: boolean;
  monthCost: number;
  legsTotalGoing: number;
  legsTotalReturning: number;
  onToggle: () => void;
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
  duplicateProfile: (pi: number) => void;
}) {
  const accents = [
    "var(--color-lime)",
    "var(--color-sky)",
    "var(--color-violet)",
    "var(--color-rose)",
  ];
  const accent = accents[pi % accents.length];

  return (
    <li
      className="group/row relative rounded-xl border border-[var(--color-border)] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-surface-2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-[var(--color-border-strong)] hover:-translate-y-[1px] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(0,0,0,0.5)]"
      style={{ borderLeftWidth: "3px", borderLeftColor: `color-mix(in srgb, ${accent} 60%, transparent)` }}
    >
      {/* Compact header row */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2.5">
        <button
          onClick={onToggle}
          className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--color-fg-muted)] transition hover:bg-white/5 hover:text-[var(--color-fg)]"
          aria-label={isOpen ? "Daralt" : "Genişlet"}
        >
          <span className={"transition " + (isOpen ? "rotate-90" : "")}>▸</span>
        </button>

        <input
          value={p.name}
          onChange={(e) => updateProfile(pi, "name", e.target.value)}
          className="min-w-[120px] max-w-full bg-transparent text-[15px] font-medium outline-none placeholder:text-[var(--color-fg-dim)] [field-sizing:content]"
          placeholder="Güzergah adı"
        />
        <button
          onClick={() => {
            const next = window.prompt("Güzergah adını düzenle:", p.name);
            if (next !== null && next.trim()) updateProfile(pi, "name", next.trim());
          }}
          className="grid size-7 shrink-0 place-items-center rounded-md text-[var(--color-fg-dim)] transition hover:bg-white/5 hover:text-[var(--color-fg-muted)]"
          title="Adı düzenle"
          aria-label="Adı düzenle"
        >
          ✎
        </button>

        {/* Right cluster — wraps below name on narrow screens */}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <div className="flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]">
          <button
            onClick={() => updateProfile(pi, "days", Math.max(0, Number(p.days) - 1))}
            className="grid size-7 place-items-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            aria-label="Azalt"
          >
            −
          </button>
          <input
            type="number"
            min={0}
            max={31}
            value={p.days}
            onChange={(e) => updateProfile(pi, "days", Number(e.target.value) || 0)}
            className="w-9 bg-transparent text-center text-[13px] font-medium tabular-nums outline-none"
          />
          <button
            onClick={() => updateProfile(pi, "days", Math.min(31, Number(p.days) + 1))}
            className="grid size-7 place-items-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            aria-label="Arttır"
          >
            +
          </button>
        </div>

        <span className="w-20 text-right font-mono text-[13px] font-medium tabular-nums text-[var(--color-fg)] sm:w-24">
          {fmtTL(monthCost)}
        </span>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => duplicateProfile(pi)}
            className="grid size-7 place-items-center rounded-md text-[var(--color-fg-muted)] transition hover:bg-white/5 hover:text-[var(--color-lime)]"
            title="Kopyala"
            aria-label="Kopyala"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
          {canRemove && (
            <button
              onClick={() => removeProfile(pi)}
              className="grid size-7 place-items-center rounded-md text-[var(--color-fg-muted)] transition hover:bg-[var(--color-rose)]/10 hover:text-[var(--color-rose)]"
              title="Sil"
              aria-label="Sil"
            >
              ✕
            </button>
          )}
        </div>
        </div>
      </div>

      {/* Expanded — leg editor */}
      {isOpen && (
        <div className="space-y-3 border-t border-[var(--color-border)] bg-[var(--color-bg-2)]/40 px-3 py-3">
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
      )}
    </li>
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
          <span className="text-[13px] text-[var(--color-fg-muted)]">
            · {legs.length} araç
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] tabular-nums text-[var(--color-fg-muted)]">
            {fmtTL(total)}
          </span>
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-white/[0.03] px-3 py-1.5 text-[12.5px] text-[var(--color-fg-muted)] transition hover:border-[var(--color-lime)]/40 hover:bg-[var(--color-lime-soft)] hover:text-[var(--color-lime)]"
          >
            <span className="text-[14px] leading-none">+</span>
            Araç ekle
          </button>
        </div>
      </header>

      <ol className="space-y-2">
        {(() => {
          const prices = computeLegPrices(legs);
          return legs.map((leg, idx) => (
          <li
            key={leg.id}
            className="group/leg flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-transparent bg-white/[0.02] p-2 transition hover:border-[var(--color-border)] sm:grid sm:grid-cols-[24px_minmax(220px,3fr)_minmax(0,1fr)_auto_auto_auto] sm:gap-x-3"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-white/5 font-mono text-[10px] tabular-nums text-[var(--color-fg-muted)]">
              {String(idx + 1).padStart(2, "0")}
            </span>

            <VehicleSelect
              value={leg.vIdx}
              onChange={(n) => onUpdate(leg.id, "vIdx", n)}
            />

            <input
              value={leg.label}
              onChange={(e) => onUpdate(leg.id, "label", e.target.value)}
              placeholder="hat (62G, M4…)"
              className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-[12px] text-[var(--color-fg-muted)] outline-none transition placeholder:text-[var(--color-fg-dim)]/60 hover:border-[var(--color-border-strong)] focus:border-[var(--color-lime)]/50 focus:text-[var(--color-fg)] focus:ring-2 focus:ring-[var(--color-lime)]/15"
            />

            {(() => {
              if (idx === 0) return null;
              const vLabel = VEHICLES[leg.vIdx]?.label || "";
              const transferApplicable =
                !vLabel.startsWith("Metrobüs") &&
                !vLabel.startsWith("Marmaray") &&
                !vLabel.startsWith("Vapur");
              if (!transferApplicable) return null;
              return (
                <button
                  onClick={() => onUpdate(leg.id, "isTransfer", !leg.isTransfer)}
                  className={
                    "group/tr inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all " +
                    (leg.isTransfer
                      ? "border-[var(--color-lime)]/40 bg-[var(--color-lime-soft)] text-[var(--color-lime)] shadow-[0_0_0_3px_rgba(214,255,61,0.06)]"
                      : "border-[var(--color-border)] bg-white/[0.02] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:bg-white/[0.05] hover:text-[var(--color-fg)]")
                  }
                  title={
                    leg.isTransfer
                      ? "Aktarma indirimi uygulanıyor — kapatmak için tıkla"
                      : "Aktarma indirimini uygulamak için tıkla"
                  }
                >
                  {leg.isTransfer ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M7 4v16M7 4 3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4" />
                      </svg>
                      aktarmalı
                    </>
                  ) : (
                    <>
                      <span className="size-1.5 rounded-full bg-current opacity-50" aria-hidden="true" />
                      aktarmasız
                    </>
                  )}
                </button>
              );
            })()}

            <span
              className={
                "ml-auto shrink-0 font-mono text-[12px] tabular-nums sm:ml-0 " +
                (leg.isTransfer ? "text-[var(--color-lime)]" : "text-[var(--color-fg)]")
              }
              title={leg.isTransfer ? "Aktarma indirimi uygulandı" : undefined}
            >
              {fmtTL(prices[idx])}
            </span>

            <button
              onClick={() => legs.length > 1 && onRemove(leg.id)}
              disabled={legs.length <= 1}
              className="grid size-7 shrink-0 place-items-center rounded-lg text-[var(--color-fg-dim)] transition hover:bg-[var(--color-rose)]/10 hover:text-[var(--color-rose)] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--color-fg-dim)]"
              aria-label="Bu aracı sil"
            >
              ✕
            </button>
          </li>
        ));
        })()}
      </ol>
    </div>
  );
}

/* ───────────────────────── Vehicle select (custom dropdown) ───────────────────────── */
function VehicleSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const v = VEHICLES[value];

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const update = () => {
      const r = wrapRef.current!.getBoundingClientRect();
      const minW = Math.min(320, window.innerWidth - 16);
      const w = Math.min(Math.max(r.width, minW), window.innerWidth - 16);
      let left = r.left;
      if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
      if (left < 8) left = 8;
      setPos({ top: r.bottom + 4, left, width: w });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative min-w-0 flex-1 basis-full sm:basis-auto"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          "flex w-full items-center gap-2 rounded-lg border bg-[var(--color-surface)] px-3 py-2 text-left text-[13px] transition " +
          (open
            ? "border-[var(--color-lime)]/50 ring-2 ring-[var(--color-lime)]/15"
            : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]")
        }
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[var(--color-lime-soft)] font-mono text-[11px] text-[var(--color-lime)]">
          {v.icon}
        </span>
        <span className="min-w-0 flex-1 truncate sm:whitespace-nowrap sm:[overflow:visible]">{v.label}</span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--color-fg-muted)]">
          {fmtTL(v.price)}
        </span>
        <span
          className={
            "shrink-0 text-[var(--color-fg-dim)] transition " +
            (open ? "rotate-180" : "")
          }
        >
          ▾
        </span>
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
          className="z-[80] max-h-[360px] overflow-auto rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] p-1 shadow-2xl"
        >
          <ul role="listbox">
            {VEHICLES.map((opt, i) => {
              if (opt.aktarma || opt.hidden) return null; // dropdown'da gizli
              const selected = i === value;
              return (
                <li key={i}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(i);
                      setOpen(false);
                    }}
                    className={
                      "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] leading-tight transition " +
                      (selected
                        ? "bg-[var(--color-lime-soft)] text-[var(--color-lime)]"
                        : "text-[var(--color-fg)] hover:bg-white/5")
                    }
                  >
                    <span
                      className={
                        "grid size-6 shrink-0 place-items-center rounded-md font-mono text-[11px] " +
                        (selected
                          ? "bg-[var(--color-lime)]/20 text-[var(--color-lime)]"
                          : "bg-white/5 text-[var(--color-fg-muted)]")
                      }
                    >
                      {opt.icon}
                    </span>
                    <span className="min-w-0 flex-1 break-words py-0.5">{opt.label}</span>
                    <span
                      className={
                        "shrink-0 font-mono text-[11px] tabular-nums " +
                        (selected ? "text-[var(--color-lime)]" : "text-[var(--color-fg-dim)]")
                      }
                    >
                      {fmtTL(opt.price)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}

function PresetSelect({ onPick }: { onPick: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const update = () => {
      const r = wrapRef.current!.getBoundingClientRect();
      const minW = Math.min(360, window.innerWidth - 16);
      const w = Math.min(Math.max(r.width, minW), window.innerWidth - 16);
      let left = r.left;
      if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
      if (left < 8) left = 8;
      setPos({ top: r.bottom + 6, left, width: w });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={
          "group flex w-full items-center gap-3 rounded-xl border border-dashed bg-gradient-to-b from-transparent to-white/[0.01] py-3 pl-4 pr-3 text-left text-[13px] transition " +
          (open
            ? "border-[var(--color-lime)]/50 bg-[var(--color-lime-soft)] text-[var(--color-lime)] ring-2 ring-[var(--color-lime)]/15"
            : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-lime)]/40 hover:bg-[var(--color-lime-soft)] hover:text-[var(--color-lime)]")
        }
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--color-lime-soft)] font-mono text-[12px] text-[var(--color-lime)]">
          ★
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--color-fg-dim)]">
            Hazır müşteri
          </span>
          <span className="block truncate text-[13px]">Listeden seç…</span>
        </span>
        <span className={"shrink-0 text-[var(--color-fg-dim)] transition " + (open ? "rotate-180" : "")}>▾</span>
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}
          className="z-[80] max-h-[420px] overflow-auto rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] p-2 shadow-2xl"
        >
          <p className="px-2 pb-1.5 pt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[var(--color-fg-dim)]">
            {CUSTOMER_PRESETS.length} müşteri
          </p>
          <ul role="listbox" className="space-y-1">
            {CUSTOMER_PRESETS.map((p) => {
              const legsCount = p.going.length + p.returning.length;
              return (
                <li key={p.key}>
                  <button
                    type="button"
                    role="option"
                    onClick={() => {
                      onPick(p.key);
                      setOpen(false);
                    }}
                    className="group/opt flex w-full items-start gap-3 rounded-xl border border-transparent px-2.5 py-2.5 text-left transition hover:border-[var(--color-lime)]/30 hover:bg-[var(--color-lime-soft)]"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--color-lime)]/15 font-display text-[15px] italic text-[var(--color-lime)]">
                      {p.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate font-display text-[15px] tracking-tight text-[var(--color-fg)]">{p.name}</span>
                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-fg-dim)]">
                          {p.days} gün
                        </span>
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
                          → {p.going.length}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
                          ← {p.returning.length}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-[var(--color-fg-muted)]">
                          {legsCount} bacak
                        </span>
                      </span>
                    </span>
                    <span className="mt-1 shrink-0 text-[var(--color-fg-dim)] transition group-hover/opt:text-[var(--color-lime)]">+</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}

