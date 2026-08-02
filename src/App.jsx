import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Plus, X, Search, Trash2, Pencil, Instagram, Linkedin,
  Mail, Link2, AlertTriangle, Clock, Check, Upload, ExternalLink, Menu,
} from "lucide-react";
import * as db from "./lib/db.js";
import { sendContactNotification } from "./lib/notify.js";
import OnePagerGenerator from "./OnePagerGenerator.jsx";

// ---------- brand ----------

const BRAND = {
  blue: "#006DDB",   // primary accent / CTAs
  gold: "#C7A05F",   // secondary accent / highlights
  maroon: "#59030E", // destructive / overdue / errors
};

// ---------- constants ----------

const PLATFORMS = ["Instagram", "LinkedIn", "Twitter/X", "Email", "Other"];
const TYPES = ["Founder", "Angel", "Pre-seed VC", "Seed VC", "Series A+ VC", "Accelerator", "Other"];
const STAGES = ["Pre-seed", "Seed", "Series A", "Growth", "Multi-stage", "N/A"];
const STATUSES = ["Not contacted", "Messaged", "Replied", "Meeting set", "Interested", "Passed"];
const COMMITMENT_STATUSES = ["None", "Soft commit", "Term sheet sent", "Signed", "Closed", "Declined"];
const DIR_STAGE_FILTERS = ["Pre-Seed", "Seed", "Early Stage", "Series A", "Series B", "Growth", "Late Stage"];

const STATUS_STYLE = {
  "Not contacted": { fg: "#8a9290", bg: "#161c1a", dot: "#8a9290" },
  "Messaged": { fg: BRAND.gold, bg: "#1f1a0a", dot: BRAND.gold },
  "Replied": { fg: BRAND.blue, bg: "#0a1420", dot: BRAND.blue },
  "Meeting set": { fg: "#7fe08a", bg: "#0c1a0e", dot: "#7fe08a" },
  "Interested": { fg: "#39ff88", bg: "#0a1f10", dot: "#39ff88" },
  "Passed": { fg: "#ff7a6b", bg: "#1f0a0d", dot: BRAND.maroon },
};

const PLATFORM_ICON = {
  "Instagram": Instagram,
  "LinkedIn": Linkedin,
  "Twitter/X": Link2,
  "Email": Mail,
  "Other": Link2,
};

const todayStr = () => new Date().toISOString().slice(0, 10);

function fmtMoney(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return v ? `$${v}` : "$0";
}

// ---------- xlsx import helpers ----------
// Real-world exports vary a lot: title rows above the real header, columns
// named "Min Check" vs "MinInvestmentSize" vs "Check Size" (one combined
// text field), "Base" vs "Country", etc. These helpers normalize all of that.

function normalizeHeader(h) {
  return String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

const FIELD_KEYWORDS = {
  name: ["investor", "name"],
  rawType: ["type"],
  country: ["country"],
  city: ["base", "city"],
  stages: ["stages", "stage"],
  industryFocus: ["industryfocus", "industry", "sector"],
  geoFocus: ["geographicalfocus", "geofocus"],
  website: ["website"],
  linkedin: ["linkedin"],
  email: ["contactemail", "email"],
  phone: ["contactphone", "phone"],
  minInvestment: ["mininvestment", "mincheck", "minimumcheck"],
  maxInvestment: ["maxinvestment", "maxcheck", "maximumcheck"],
  checkSizeText: ["checksize"],
  tier: ["tier"],
  score: ["score"],
  priority: ["priority"],
  extraNotes: ["verificationnote", "howtoapproach", "fitfor", "notes", "description"],
};

function parseMoney(text) {
  const matches = [...String(text).matchAll(/([\d,.]+)\s*(k|m)?/gi)].filter((m) => m[1] && m[1] !== ".");
  return matches.map((m) => {
    let n = parseFloat(m[1].replace(/,/g, ""));
    if (/k/i.test(m[2])) n *= 1_000;
    if (/m/i.test(m[2])) n *= 1_000_000;
    return n;
  });
}

// Finds the real header row (title/subtitle rows above it have far fewer
// filled cells) and maps whatever columns exist to our canonical fields.
function parseSheetRecords(workbook, sheetName) {
  const raw = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
  const headerIdx = raw.findIndex((row) => row.filter((c) => String(c).trim() !== "").length >= 3);
  if (headerIdx === -1) return [];

  const headers = raw[headerIdx].map(normalizeHeader);
  const colIndex = {};
  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    const idx = headers.findIndex((h) => keywords.some((k) => h.includes(k)));
    if (idx !== -1) colIndex[field] = idx;
  }

  const get = (row, field) => (field in colIndex ? String(row[colIndex[field]] ?? "").trim() : "");

  return raw
    .slice(headerIdx + 1)
    .map((row) => {
      const name = get(row, "name");
      if (!name) return null;

      let minInvestment = Number(get(row, "minInvestment").replace(/[^0-9.]/g, "")) || 0;
      let maxInvestment = Number(get(row, "maxInvestment").replace(/[^0-9.]/g, "")) || 0;
      const checkSizeText = get(row, "checkSizeText");
      if (!minInvestment && !maxInvestment && checkSizeText) {
        const nums = parseMoney(checkSizeText);
        if (nums.length >= 2) { minInvestment = nums[0]; maxInvestment = nums[1]; }
        else if (nums.length === 1) { minInvestment = nums[0]; maxInvestment = nums[0]; }
      }

      const notesParts = [
        get(row, "tier") ? `Tier: ${get(row, "tier")}` : "",
        get(row, "score") ? `Score: ${get(row, "score")}` : "",
        get(row, "priority") ? `Priority: ${get(row, "priority")}` : "",
        checkSizeText ? `Check size (as listed): ${checkSizeText}` : "",
        get(row, "extraNotes"),
      ].filter(Boolean).join(" · ");

      return {
        name,
        rawType: get(row, "rawType"),
        city: get(row, "city"),
        country: get(row, "country"),
        website: get(row, "website"),
        linkedin: get(row, "linkedin"),
        email: get(row, "email"),
        stages: get(row, "stages"),
        industryFocus: get(row, "industryFocus"),
        geoFocus: get(row, "geoFocus"),
        minInvestment,
        maxInvestment,
        notes: notesParts.length > 300 ? notesParts.slice(0, 300) + "…" : notesParts,
      };
    })
    .filter(Boolean);
}

const emptyForm = () => ({
  id: null,
  name: "",
  company: "",
  country: "",
  platform: "Instagram",
  handle: "",
  type: "Founder",
  stageFocus: "N/A",
  status: "Not contacted",
  lastContact: "",
  nextFollowUp: "",
  notes: "",
  commitmentStatus: "None",
  commitmentAmount: "",
  targetCloseDate: "",
});

// Seeded once per user, on first load only. Sophia and Kate from prior
// outreach drafts, plus a short researched list of active pan-African
// investors compiled from public sources — not scraped, hand-verified
// names to research further and contact manually.
const DEFAULT_CONTACTS = [
  { name: "Sophia Amoruso", company: "Trust Fund", country: "United States", platform: "Instagram", handle: "@sophiaamoruso", type: "Angel", stageFocus: "Pre-seed", status: "Not contacted", lastContact: "", nextFollowUp: "", notes: "Founder & investor at Trust Fund. Built Nasty Gal, invested in 45+ startups. Drafted intro DM." },
  { name: "Kate McAndrew", company: "Baukunst", country: "United States", platform: "Instagram", handle: "@kate__mcandrew", type: "Pre-seed VC", stageFocus: "Pre-seed", status: "Not contacted", lastContact: "", nextFollowUp: "", notes: "Pre-seed VC at Baukunst, $100M fund, SF, invests at frontier of tech + design. Prefers pitches by email: pitch@baukunst.co. Drafted pitch email." },
  { name: "Mike Mompi", company: "Enza Capital", country: "Kenya", platform: "LinkedIn", handle: "", type: "Seed VC", stageFocus: "Pre-seed", status: "Not contacted", lastContact: "", nextFollowUp: "", notes: "Co-founder & Managing Partner, Enza Capital (Nairobi). Pre-seed through Series B. Fintech, logistics, health, human capital, climate-smart. Find LinkedIn handle before outreach." },
  { name: "Lexi Novitske", company: "Norrsken22", country: "Nigeria", platform: "LinkedIn", handle: "", type: "Series A+ VC", stageFocus: "Multi-stage", status: "Not contacted", lastContact: "", nextFollowUp: "", notes: "General Partner, Norrsken22 (Lagos). Fintech & enterprise platforms across Africa. Find LinkedIn handle before outreach." },
  { name: "Kola Aina", company: "Ventures Platform", country: "Nigeria", platform: "LinkedIn", handle: "", type: "Seed VC", stageFocus: "Seed", status: "Not contacted", lastContact: "", nextFollowUp: "", notes: "Founding Partner, Ventures Platform Fund (Nigeria). Active early-stage pan-African investor. Find LinkedIn handle before outreach." },
  { name: "Olumide Soyombo", company: "Voltron Capital", country: "Nigeria", platform: "LinkedIn", handle: "", type: "Angel", stageFocus: "Pre-seed", status: "Not contacted", lastContact: "", nextFollowUp: "", notes: "Co-founder, Voltron Capital. Prominent Nigerian angel/early-stage investor. Find LinkedIn handle before outreach." },
  { name: "Maya Horgan Famodu", company: "Ingressive Capital", country: "Nigeria", platform: "LinkedIn", handle: "", type: "Seed VC", stageFocus: "Seed", status: "Not contacted", lastContact: "", nextFollowUp: "", notes: "Founder & Managing Partner, Ingressive Capital. Early-stage African tech investor. Find LinkedIn handle before outreach." },
];

// ---------- small UI atoms ----------

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 text-[11px] tracking-wide uppercase whitespace-nowrap border transition-colors"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        borderColor: active ? BRAND.blue : "#2a3330",
        color: active ? BRAND.blue : "#8a9290",
        background: active ? "#0a1420" : "transparent",
      }}
    >
      {children}
    </button>
  );
}

function StatusDot({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE["Not contacted"];
  return <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.dot }} />;
}

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE["Not contacted"];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] tracking-widest uppercase"
      style={{ color: s.fg, background: s.bg, fontFamily: "'JetBrains Mono', monospace" }}
    >
      <StatusDot status={status} />
      {status}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mono text-[10px] uppercase tracking-widest block mb-1" style={{ color: "#4d5652" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = { borderColor: "#2a3330", color: "#e8e6d9" };

// ---------- main component ----------

export default function OutreachTerminal() {
  const [tab, setTab] = useState("pipeline"); // "pipeline" | "directory"
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // pipeline state
  const [contacts, setContacts] = useState([]);
  const [loadingPipeline, setLoadingPipeline] = useState(true);
  const [pipelineError, setPipelineError] = useState(null);
  const [search, setSearch] = useState("");
  const [fType, setFType] = useState("All");
  const [fStage, setFStage] = useState("All");
  const [fStatus, setFStatus] = useState("All");
  const [fPlatform, setFPlatform] = useState("All");
  const [fCountry, setFCountry] = useState("All");
  const [fCommitment, setFCommitment] = useState("All");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [now, setNow] = useState(new Date());
  const reduceMotion = useRef(
    typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  // directory state
  const [batches, setBatches] = useState([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState([]); // empty = all
  const [directory, setDirectory] = useState([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [directoryError, setDirectoryError] = useState(null);
  const [importing, setImporting] = useState(false);
  const [pendingImport, setPendingImport] = useState(null); // { fileName, records }
  const [batchNameDraft, setBatchNameDraft] = useState("");
  const [dirSearch, setDirSearch] = useState("");
  const [dirStage, setDirStage] = useState("All");
  const [dirCountry, setDirCountry] = useState("");
  const [dirIndustry, setDirIndustry] = useState("");
  const [dirCheckSize, setDirCheckSize] = useState("");
  const [addedFlash, setAddedFlash] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(t);
  }, []);

  // ----- load pipeline (seed once per user if empty) -----
  useEffect(() => {
    (async () => {
      try {
        let rows = await db.fetchContacts();
        if (rows.length === 0 && !(await db.hasSeeded())) {
          await db.insertContacts(DEFAULT_CONTACTS);
          await db.markSeeded();
          rows = await db.fetchContacts();
        }
        setContacts(rows);
      } catch (e) {
        setPipelineError(e.message || "Could not load your pipeline.");
      } finally {
        setLoadingPipeline(false);
      }
    })();
  }, []);

  // ----- load directory batches, then investors for the current selection -----
  useEffect(() => {
    (async () => {
      try {
        const b = await db.fetchBatches();
        setBatches(b);
      } catch (e) {
        setDirectoryError(e.message || "Could not load your directory.");
      } finally {
        setLoadingDirectory(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (loadingDirectory) return;
    (async () => {
      try {
        const rows = await db.fetchInvestors(selectedBatchIds.length ? selectedBatchIds : null);
        setDirectory(rows);
      } catch (e) {
        setDirectoryError(e.message || "Could not load directory rows.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatchIds, batches.length]);

  function isOverdue(c) {
    if (!c.nextFollowUp) return false;
    if (["Meeting set", "Passed"].includes(c.status)) return false;
    return c.nextFollowUp < todayStr();
  }
  function isDueToday(c) {
    return c.nextFollowUp === todayStr() && !["Meeting set", "Passed"].includes(c.status);
  }

  const stats = useMemo(() => {
    const total = contacts.length;
    const active = contacts.filter((c) => c.status !== "Passed").length;
    const overdue = contacts.filter(isOverdue).length;
    const replied = contacts.filter((c) => ["Replied", "Meeting set", "Interested"].includes(c.status)).length;
    const committed = contacts
      .filter((c) => ["Signed", "Closed"].includes(c.commitmentStatus))
      .reduce((sum, c) => sum + (Number(c.commitmentAmount) || 0), 0);
    return { total, active, overdue, replied, committed };
  }, [contacts]);

  const tickerItems = useMemo(() => contacts.filter((c) => isOverdue(c) || isDueToday(c)), [contacts]);

  const countryOptions = useMemo(() => {
    const set = new Set(contacts.map((c) => c.country).filter(Boolean));
    return Array.from(set).sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    return contacts
      .filter((c) => (fType === "All" ? true : c.type === fType))
      .filter((c) => (fStage === "All" ? true : c.stageFocus === fStage))
      .filter((c) => (fStatus === "All" ? true : c.status === fStatus))
      .filter((c) => (fPlatform === "All" ? true : c.platform === fPlatform))
      .filter((c) => (fCountry === "All" ? true : c.country === fCountry))
      .filter((c) => (fCommitment === "All" ? true : c.commitmentStatus === fCommitment))
      .filter((c) => (overdueOnly ? isOverdue(c) || isDueToday(c) : true))
      .filter((c) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.company || "").toLowerCase().includes(q) ||
          c.handle.toLowerCase().includes(q) ||
          c.notes.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const ao = isOverdue(a) ? 0 : isDueToday(a) ? 1 : 2;
        const bo = isOverdue(b) ? 0 : isDueToday(b) ? 1 : 2;
        if (ao !== bo) return ao - bo;
        return (a.nextFollowUp || "9999").localeCompare(b.nextFollowUp || "9999");
      });
  }, [contacts, fType, fStage, fStatus, fPlatform, fCountry, fCommitment, overdueOnly, search]);

  function openAdd() { setForm(emptyForm()); setModalOpen(true); }
  function openEdit(c) { setForm(c); setModalOpen(true); }

  async function saveForm() {
    if (!form.name.trim()) return;
    try {
      if (form.id) {
        const prev = contacts.find((c) => c.id === form.id);
        await db.updateContact(form);
        setContacts(contacts.map((c) => (c.id === form.id ? form : c)));
        if (prev && prev.status !== "Messaged" && form.status === "Messaged") {
          notifyAndLog(form, "marked contacted");
        }
      } else {
        const created = await db.insertContact(form);
        setContacts([...contacts, created]);
      }
      setPipelineError(null);
      setModalOpen(false);
    } catch (e) {
      setPipelineError(e.message || "Save failed.");
    }
  }

  async function removeContact(id) {
    try {
      await db.deleteContactRow(id);
      setContacts(contacts.filter((c) => c.id !== id));
      setPipelineError(null);
    } catch (e) {
      setPipelineError(e.message || "Delete failed.");
    }
  }

  async function notifyAndLog(contact, actionLabel) {
    const result = await sendContactNotification(contact.name, actionLabel, contact.notes);
    try {
      await db.logEmailSent({
        contactId: contact.id,
        contactName: contact.name,
        triggerType: actionLabel,
        sentOk: result.ok,
        error: result.ok ? null : result.error,
      });
    } catch {
      // logging the log entry failed — not worth surfacing over the actual action
    }
  }

  async function markContactedToday(c) {
    const updated = { ...c, lastContact: todayStr(), status: c.status === "Not contacted" ? "Messaged" : c.status };
    try {
      await db.updateContact(updated);
      setContacts(contacts.map((x) => (x.id === c.id ? updated : x)));
      notifyAndLog(updated, "marked contacted");
    } catch (e) {
      setPipelineError(e.message || "Update failed.");
    }
  }

  async function snooze(c, days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const updated = { ...c, nextFollowUp: d.toISOString().slice(0, 10) };
    try {
      await db.updateContact(updated);
      setContacts(contacts.map((x) => (x.id === c.id ? updated : x)));
    } catch (e) {
      setPipelineError(e.message || "Update failed.");
    }
  }

  // ----- directory: import (handles multi-sheet workbooks, title rows above
  // the real header, and differently-named columns across exports) -----
  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setDirectoryError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });

      const sheetInfo = wb.SheetNames.map((n) => {
        const raw = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: "" });
        return { name: n, rowCount: raw.length };
      });
      // Default to whichever sheet has the most rows — usually the full data
      // sheet rather than a "Read Me" or a smaller priority-subset tab.
      const best = sheetInfo.reduce((a, b) => (b.rowCount > a.rowCount ? b : a), sheetInfo[0]);

      const defaultName = file.name.replace(/\.(xlsx|xls|csv)$/i, "");
      setBatchNameDraft(defaultName);
      setPendingImport({
        fileName: file.name,
        workbook: wb,
        sheets: sheetInfo,
        activeSheet: best.name,
        records: parseSheetRecords(wb, best.name),
      });
    } catch (err) {
      setDirectoryError("Could not read that file — make sure it's a .xlsx, .xls or .csv export.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function switchImportSheet(sheetName) {
    setPendingImport((prev) =>
      prev ? { ...prev, activeSheet: sheetName, records: parseSheetRecords(prev.workbook, sheetName) } : prev
    );
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setImporting(true);
    setDirectoryError(null);
    try {
      const name = batchNameDraft.trim() || pendingImport.fileName;
      const batch = await db.importBatch(name, pendingImport.records);
      setBatches([batch, ...batches]);
      setSelectedBatchIds([batch.id]);
      setPendingImport(null);
    } catch (e) {
      setDirectoryError(e.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  async function removeBatch(id) {
    try {
      await db.deleteBatch(id);
      const next = batches.filter((b) => b.id !== id);
      setBatches(next);
      setSelectedBatchIds(selectedBatchIds.filter((x) => x !== id));
    } catch (e) {
      setDirectoryError(e.message || "Delete failed.");
    }
  }

  function toggleBatch(id) {
    setSelectedBatchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function addToPipeline(rec) {
    const stageGuess = ["Pre-Seed", "Seed", "Series A", "Growth"].find((s) => rec.stages.includes(s)) || "N/A";
    const typeGuess = /vc|ventures|capital|partners|fund/i.test(rec.rawType + rec.name) ? "Seed VC" : "Angel";
    const platformGuess = rec.linkedin ? "LinkedIn" : rec.email ? "Email" : "Other";
    const handleGuess = rec.linkedin || rec.email || rec.website;

    const newContact = {
      name: rec.name,
      company: rec.rawType === "Angel Investor" ? "" : rec.rawType,
      country: rec.country,
      platform: platformGuess,
      handle: handleGuess,
      type: typeGuess,
      stageFocus: stageGuess === "Pre-Seed" ? "Pre-seed" : stageGuess,
      status: "Not contacted",
      lastContact: "",
      nextFollowUp: "",
      notes: [
        rec.industryFocus ? `Focus: ${rec.industryFocus}` : "",
        rec.minInvestment || rec.maxInvestment ? `Check size: $${rec.minInvestment.toLocaleString()}–$${rec.maxInvestment.toLocaleString()}` : "",
        rec.notes,
      ].filter(Boolean).join(" · "),
    };
    try {
      const created = await db.insertContact(newContact);
      setContacts((prev) => [...prev, created]);
      setAddedFlash(rec.id);
      setTimeout(() => setAddedFlash(null), 1500);
    } catch (e) {
      setDirectoryError(e.message || "Could not add to pipeline.");
    }
  }

  const directoryFiltered = useMemo(() => {
    const checkSize = Number(dirCheckSize) || null;
    return directory
      .filter((r) => (dirStage === "All" ? true : r.stages.includes(dirStage)))
      .filter((r) => (dirCountry.trim() ? r.country.toLowerCase().includes(dirCountry.trim().toLowerCase()) : true))
      .filter((r) => (dirIndustry.trim() ? r.industryFocus.toLowerCase().includes(dirIndustry.trim().toLowerCase()) : true))
      .filter((r) => {
        if (!checkSize) return true;
        const min = r.minInvestment || 0;
        const max = r.maxInvestment || Infinity;
        return checkSize >= min && checkSize <= max;
      })
      .filter((r) => {
        if (!dirSearch.trim()) return true;
        const q = dirSearch.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.industryFocus.toLowerCase().includes(q) ||
          r.geoFocus.toLowerCase().includes(q) ||
          r.country.toLowerCase().includes(q)
        );
      })
      .slice(0, 300);
  }, [directory, dirStage, dirCountry, dirIndustry, dirCheckSize, dirSearch]);

  const clockStr = now.toTimeString().slice(0, 5);

  return (
    <div className="min-h-screen w-full" style={{ background: "#0a0e0c", color: "#e8e6d9", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        .mono { font-family: 'JetBrains Mono', monospace; }
        @keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ticker-track { animation: ticker-scroll 22s linear infinite; }
        .no-motion .ticker-track { animation: none; }
        input::placeholder, textarea::placeholder { color: #4d5652; }
        select { background: #0f1512; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: #2a3330; }
        @keyframes flash-in { 0% { background: #0a1420; } 100% { background: transparent; } }
        .flash { animation: flash-in 1.4s ease-out; }
      `}</style>

      {/* top bar */}
      <div className="border-b" style={{ borderColor: "#1c2422" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <img src="/logo.png" alt="Suckmill" style={{ height: 40, width: "auto" }} />
          <div className="hidden sm:flex mono text-xs items-center gap-4" style={{ color: "#8a9290" }}>
            <span>{clockStr}</span>
            <span>|</span>
            <span>TRACKED <b style={{ color: "#e8e6d9" }}>{stats.total}</b></span>
            <span>ACTIVE <b style={{ color: "#7fe08a" }}>{stats.active}</b></span>
            <span>REPLIED <b style={{ color: BRAND.blue }}>{stats.replied}</b></span>
            <span>OVERDUE <b style={{ color: stats.overdue ? "#ff7a6b" : "#8a9290" }}>{stats.overdue}</b></span>
            <span>COMMITTED <b style={{ color: BRAND.gold }}>{fmtMoney(stats.committed)}</b></span>
          </div>
          <button className="sm:hidden p-1.5" onClick={() => setMobileMenuOpen((v) => !v)} style={{ color: "#8a9290" }}>
            <Menu size={20} />
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="sm:hidden max-w-6xl mx-auto px-4 pb-3 mono text-xs flex flex-wrap gap-x-4 gap-y-1" style={{ color: "#8a9290" }}>
            <span>{clockStr}</span>
            <span>TRACKED <b style={{ color: "#e8e6d9" }}>{stats.total}</b></span>
            <span>ACTIVE <b style={{ color: "#7fe08a" }}>{stats.active}</b></span>
            <span>REPLIED <b style={{ color: BRAND.blue }}>{stats.replied}</b></span>
            <span>OVERDUE <b style={{ color: stats.overdue ? "#ff7a6b" : "#8a9290" }}>{stats.overdue}</b></span>
            <span>COMMITTED <b style={{ color: BRAND.gold }}>{fmtMoney(stats.committed)}</b></span>
          </div>
        )}
        {/* menu / tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 -mb-px overflow-x-auto">
          {[
            { id: "pipeline", label: "Pipeline" },
            { id: "directory", label: `Investor Directory${directory.length ? ` (${directory.length})` : ""}` },
            { id: "onepager", label: "One-Pager" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="mono text-[11px] uppercase tracking-widest px-3 py-2 border-b-2 whitespace-nowrap"
              style={{ borderColor: tab === t.id ? BRAND.blue : "transparent", color: tab === t.id ? BRAND.blue : "#8a9290" }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ticker */}
      <div className={"overflow-hidden border-b " + (reduceMotion.current ? "no-motion" : "")} style={{ borderColor: "#1c2422", background: "#0d1210" }}>
        <div className="py-1.5 whitespace-nowrap">
          {tickerItems.length === 0 ? (
            <div className="mono text-[11px] px-4" style={{ color: "#4d5652" }}>— no follow-ups due —</div>
          ) : (
            <div className="ticker-track inline-flex">
              {[...tickerItems, ...tickerItems].map((c, i) => (
                <span key={i} className="mono text-[11px] px-4 inline-flex items-center gap-1.5" style={{ color: isOverdue(c) ? "#ff7a6b" : BRAND.gold }}>
                  <AlertTriangle size={11} />
                  {c.name} · {c.nextFollowUp} · follow up
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {tab === "onepager" ? (
        <OnePagerGenerator />
      ) : (
        <div className="max-w-6xl mx-auto px-4 py-5">
          {tab === "pipeline" ? (
          <PipelineTab
            error={pipelineError}
            search={search} setSearch={setSearch}
            fType={fType} setFType={setFType}
            fStage={fStage} setFStage={setFStage}
            fStatus={fStatus} setFStatus={setFStatus}
            fPlatform={fPlatform} setFPlatform={setFPlatform}
            fCountry={fCountry} setFCountry={setFCountry}
            fCommitment={fCommitment} setFCommitment={setFCommitment}
            countryOptions={countryOptions}
            overdueOnly={overdueOnly} setOverdueOnly={setOverdueOnly}
            openAdd={openAdd}
            loading={loadingPipeline}
            filtered={filtered}
            contactsLength={contacts.length}
            isOverdue={isOverdue} isDueToday={isDueToday}
            markContactedToday={markContactedToday}
            snooze={snooze}
            openEdit={openEdit}
            removeContact={removeContact}
          />
        ) : (
          <DirectoryTab
            error={directoryError}
            importing={importing}
            fileInputRef={fileInputRef}
            handleFile={handleFile}
            pendingImport={pendingImport}
            switchImportSheet={switchImportSheet}
            batchNameDraft={batchNameDraft}
            setBatchNameDraft={setBatchNameDraft}
            confirmImport={confirmImport}
            cancelImport={() => setPendingImport(null)}
            batches={batches}
            selectedBatchIds={selectedBatchIds}
            toggleBatch={toggleBatch}
            clearSelection={() => setSelectedBatchIds([])}
            removeBatch={removeBatch}
            directory={directory}
            loading={loadingDirectory}
            dirSearch={dirSearch} setDirSearch={setDirSearch}
            dirStage={dirStage} setDirStage={setDirStage}
            dirCountry={dirCountry} setDirCountry={setDirCountry}
            dirIndustry={dirIndustry} setDirIndustry={setDirIndustry}
            dirCheckSize={dirCheckSize} setDirCheckSize={setDirCheckSize}
            directoryFiltered={directoryFiltered}
            addToPipeline={addToPipeline}
            addedFlash={addedFlash}
          />
          )}
        </div>
      )}

      {modalOpen && (
        <ContactModal form={form} setForm={setForm} onClose={() => setModalOpen(false)} onSave={saveForm} onDelete={removeContact} />
      )}
    </div>
  );
}

// ---------- Pipeline tab ----------

function PipelineTab(props) {
  const {
    error, search, setSearch, fType, setFType, fStage, setFStage, fStatus, setFStatus,
    fPlatform, setFPlatform, fCountry, setFCountry, fCommitment, setFCommitment, countryOptions, overdueOnly, setOverdueOnly,
    openAdd, loading, filtered, contactsLength, isOverdue, isDueToday,
    markContactedToday, snooze, openEdit, removeContact,
  } = props;

  return (
    <>
      {error && <div className="mono text-xs mb-4 px-3 py-2 border" style={{ borderColor: BRAND.maroon, color: "#ff7a6b" }}>{error}</div>}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 px-2.5 py-1.5 border flex-1 min-w-[200px]" style={{ borderColor: "#2a3330" }}>
          <Search size={14} color="#8a9290" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search name, company, notes..." className="bg-transparent outline-none text-sm flex-1 min-w-0" style={{ color: "#e8e6d9" }} />
        </div>
        <button onClick={openAdd} className="mono text-xs uppercase tracking-wide px-3 py-2 flex items-center gap-1.5 shrink-0" style={{ background: BRAND.blue, color: "#fff" }}>
          <Plus size={14} /> Add contact
        </button>
      </div>

      <FilterRow label="Type" value={fType} setValue={setFType} options={TYPES} />
      <FilterRow label="Stage" value={fStage} setValue={setFStage} options={STAGES} />
      <FilterRow label="Status" value={fStatus} setValue={setFStatus} options={STATUSES} />
      <FilterRow label="Platform" value={fPlatform} setValue={setFPlatform} options={PLATFORMS} />
      {countryOptions.length > 0 && <FilterRow label="Country" value={fCountry} setValue={setFCountry} options={countryOptions} />}
      <FilterRow label="Commitment" value={fCommitment} setValue={setFCommitment} options={COMMITMENT_STATUSES} />
      <div className="flex flex-wrap gap-1.5 mb-5">
        <Chip active={overdueOnly} onClick={() => setOverdueOnly((v) => !v)}>Due / overdue only</Chip>
      </div>

      {loading ? (
        <div className="mono text-sm" style={{ color: "#8a9290" }}>loading...</div>
      ) : filtered.length === 0 ? (
        <div className="border py-14 text-center" style={{ borderColor: "#1c2422" }}>
          <p className="mono text-sm mb-1" style={{ color: "#8a9290" }}>{contactsLength === 0 ? "no contacts tracked yet" : "nothing matches these filters"}</p>
          <p className="text-sm" style={{ color: "#4d5652" }}>{contactsLength === 0 ? "add the first founder or investor to start your pipeline" : "try clearing a filter"}</p>
        </div>
      ) : (
        <div className="border-t" style={{ borderColor: "#1c2422" }}>
          {filtered.map((c) => {
            const Icon = PLATFORM_ICON[c.platform] || Link2;
            const overdue = isOverdue(c);
            const dueToday = isDueToday(c);
            return (
              <div key={c.id} className="border-b px-1 py-3 flex flex-wrap items-center gap-x-4 gap-y-2" style={{ borderColor: "#1c2422" }}>
                <div className="flex items-center gap-2 min-w-[160px]">
                  <Icon size={14} color="#8a9290" />
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="mono text-[11px]" style={{ color: "#8a9290" }}>{c.company ? c.company + " · " : ""}{c.handle || "no handle yet"}</div>
                  </div>
                </div>
                <span className="mono text-[10px] uppercase px-2 py-0.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}>{c.type}</span>
                <span className="mono text-[10px] uppercase px-2 py-0.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}>{c.stageFocus}</span>
                {c.country && <span className="mono text-[10px] uppercase px-2 py-0.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}>{c.country}</span>}
                <StatusBadge status={c.status} />
                {c.commitmentStatus !== "None" && (
                  <span className="mono text-[10px] uppercase px-2 py-0.5 border" style={{ borderColor: BRAND.gold, color: BRAND.gold }}>
                    {c.commitmentStatus}{c.commitmentAmount ? ` · ${fmtMoney(c.commitmentAmount)}` : ""}
                  </span>
                )}
                <div className="mono text-[11px]" style={{ color: overdue ? "#ff7a6b" : dueToday ? BRAND.gold : "#8a9290" }}>
                  {c.nextFollowUp ? `next: ${c.nextFollowUp}` : "no follow-up set"}{overdue && " (overdue)"}{dueToday && " (today)"}
                </div>
                {c.notes && (
                  <div className="text-xs italic flex-1 min-w-[140px]" style={{ color: "#6b756f" }} title={c.notes}>
                    {c.notes.length > 60 ? c.notes.slice(0, 60) + "…" : c.notes}
                  </div>
                )}
                <div className="flex items-center gap-1 w-full sm:w-auto sm:ml-auto justify-end">
                  <button onClick={() => markContactedToday(c)} title="Mark contacted today" className="p-1.5 border" style={{ borderColor: "#2a3330", color: "#7fe08a" }}><Check size={13} /></button>
                  <button onClick={() => snooze(c, 7)} title="Follow up in 7 days" className="p-1.5 border" style={{ borderColor: "#2a3330", color: BRAND.gold }}><Clock size={13} /></button>
                  <button onClick={() => openEdit(c)} title="Edit" className="p-1.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}><Pencil size={13} /></button>
                  <button onClick={() => removeContact(c.id)} title="Delete" className="p-1.5 border" style={{ borderColor: "#2a3330", color: "#ff7a6b" }}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function FilterRow({ label, value, setValue, options }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      <span className="mono text-[10px] uppercase self-center mr-1" style={{ color: "#4d5652" }}>{label}</span>
      <Chip active={value === "All"} onClick={() => setValue("All")}>All</Chip>
      {options.map((o) => <Chip key={o} active={value === o} onClick={() => setValue(o)}>{o}</Chip>)}
    </div>
  );
}

// ---------- Directory tab ----------

function DirectoryTab(props) {
  const {
    error, importing, fileInputRef, handleFile, pendingImport, switchImportSheet, batchNameDraft, setBatchNameDraft,
    confirmImport, cancelImport, batches, selectedBatchIds, toggleBatch, clearSelection, removeBatch,
    directory, loading, dirSearch, setDirSearch, dirStage, setDirStage, dirCountry, setDirCountry,
    dirIndustry, setDirIndustry, dirCheckSize, setDirCheckSize, directoryFiltered, addToPipeline, addedFlash,
  } = props;

  return (
    <>
      <div className="mb-4 border p-3" style={{ borderColor: "#1c2422", background: "#0d1210" }}>
        <p className="text-sm mb-2" style={{ color: "#8a9290" }}>
          Import a spreadsheet of investors (.xlsx, .xls or .csv) — expects columns like{" "}
          <span className="mono text-[11px]">Investor, Type, Country, Website, LinkedIn, ContactEmail, Stages, IndustryFocus, GeographicalFocus, MinInvestmentSize, MaxInvestmentSize</span>.
          Each import is saved as its own named batch — nothing gets overwritten.
        </p>
        {!pendingImport ? (
          <button onClick={() => fileInputRef.current && fileInputRef.current.click()} className="mono text-xs uppercase tracking-wide px-3 py-2 flex items-center gap-1.5" style={{ background: BRAND.blue, color: "#fff" }}>
            <Upload size={14} /> Import spreadsheet
          </button>
        ) : (
          <div>
            {pendingImport.sheets && pendingImport.sheets.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className="mono text-[10px] uppercase mr-1" style={{ color: "#4d5652" }}>Sheet:</span>
                {pendingImport.sheets.map((s) => (
                  <Chip key={s.name} active={pendingImport.activeSheet === s.name} onClick={() => switchImportSheet(s.name)}>
                    {s.name} ({s.rowCount})
                  </Chip>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs" style={{ color: "#8a9290" }}>{pendingImport.records.length} rows found — save as:</span>
              <input value={batchNameDraft} onChange={(e) => setBatchNameDraft(e.target.value)} className="bg-transparent border px-2 py-1.5 text-sm outline-none flex-1 min-w-[160px]" style={inputStyle} />
              <button onClick={confirmImport} disabled={importing || pendingImport.records.length === 0} className="mono text-xs uppercase px-3 py-1.5" style={{ background: BRAND.blue, color: "#fff" }}>
                {importing ? "Importing..." : "Confirm import"}
              </button>
              <button onClick={cancelImport} className="mono text-xs uppercase px-3 py-1.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}>Cancel</button>
            </div>
            {pendingImport.records.length === 0 && (
              <p className="text-xs mt-1" style={{ color: BRAND.gold }}>No rows detected on this sheet — try a different sheet above.</p>
            )}
          </div>
        )}
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
        {error && <div className="mono text-xs mt-2" style={{ color: "#ff7a6b" }}>{error}</div>}
      </div>

      {batches.length > 0 && (
        <div className="mb-4">
          <div className="mono text-[10px] uppercase mb-1.5" style={{ color: "#4d5652" }}>
            Imported batches — tap to filter, or leave none selected to see all
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <Chip active={selectedBatchIds.length === 0} onClick={clearSelection}>All batches</Chip>
            {batches.map((b) => (
              <span key={b.id} className="inline-flex items-center border" style={{ borderColor: selectedBatchIds.includes(b.id) ? BRAND.blue : "#2a3330" }}>
                <button
                  onClick={() => toggleBatch(b.id)}
                  className="px-2.5 py-1 text-[11px] mono uppercase whitespace-nowrap"
                  style={{ color: selectedBatchIds.includes(b.id) ? BRAND.blue : "#8a9290", background: selectedBatchIds.includes(b.id) ? "#0a1420" : "transparent" }}
                >
                  {b.name} ({b.row_count})
                </button>
                <button onClick={() => removeBatch(b.id)} title="Delete this batch" className="px-1.5 py-1" style={{ color: "#8a9290" }}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="mono text-sm" style={{ color: "#8a9290" }}>loading...</div>
      ) : batches.length === 0 ? (
        <div className="border py-14 text-center" style={{ borderColor: "#1c2422" }}>
          <p className="mono text-sm mb-1" style={{ color: "#8a9290" }}>no directory imported yet</p>
          <p className="text-sm" style={{ color: "#4d5652" }}>import a spreadsheet above to build a searchable, filterable investor list</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex items-center gap-2 px-2.5 py-1.5 border flex-1 min-w-[180px]" style={{ borderColor: "#2a3330" }}>
              <Search size={14} color="#8a9290" />
              <input value={dirSearch} onChange={(e) => setDirSearch(e.target.value)} placeholder="search name, industry, geography..." className="bg-transparent outline-none text-sm flex-1 min-w-0" style={{ color: "#e8e6d9" }} />
            </div>
            <input value={dirCountry} onChange={(e) => setDirCountry(e.target.value)} placeholder="country contains..." className="bg-transparent border px-2.5 py-1.5 text-sm outline-none w-full sm:w-40" style={inputStyle} />
            <input value={dirIndustry} onChange={(e) => setDirIndustry(e.target.value)} placeholder="industry contains..." className="bg-transparent border px-2.5 py-1.5 text-sm outline-none w-full sm:w-40" style={inputStyle} />
            <input value={dirCheckSize} onChange={(e) => setDirCheckSize(e.target.value)} type="number" placeholder="my check size ($)" className="bg-transparent border px-2.5 py-1.5 text-sm outline-none w-full sm:w-36" style={inputStyle} />
          </div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="mono text-[10px] uppercase self-center mr-1" style={{ color: "#4d5652" }}>Stage</span>
            <Chip active={dirStage === "All"} onClick={() => setDirStage("All")}>All</Chip>
            {DIR_STAGE_FILTERS.map((s) => <Chip key={s} active={dirStage === s} onClick={() => setDirStage(s)}>{s}</Chip>)}
          </div>

          <div className="mono text-[11px] mb-2" style={{ color: "#4d5652" }}>
            showing {directoryFiltered.length} of {directory.length}{directoryFiltered.length === 300 ? " (narrow filters to see more)" : ""}
          </div>

          <div className="border-t" style={{ borderColor: "#1c2422" }}>
            {directoryFiltered.map((r) => (
              <div key={r.id} className={"border-b px-1 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 " + (addedFlash === r.id ? "flash" : "")} style={{ borderColor: "#1c2422" }}>
                <div className="min-w-[160px]">
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="mono text-[11px]" style={{ color: "#8a9290" }}>{r.rawType}{r.country ? " · " + r.country : ""}</div>
                </div>
                <div className="text-xs flex-1 min-w-[160px]" style={{ color: "#6b756f" }} title={r.industryFocus}>
                  {r.industryFocus.length > 70 ? r.industryFocus.slice(0, 70) + "…" : r.industryFocus || "—"}
                </div>
                {(r.minInvestment || r.maxInvestment) ? (
                  <span className="mono text-[10px] px-2 py-0.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}>
                    ${r.minInvestment.toLocaleString()}–${r.maxInvestment.toLocaleString()}
                  </span>
                ) : null}
                <div className="flex items-center gap-1 w-full sm:w-auto sm:ml-auto justify-end">
                  {r.linkedin && <a href={r.linkedin} target="_blank" rel="noreferrer" title="LinkedIn" className="p-1.5 border" style={{ borderColor: "#2a3330", color: BRAND.blue }}><Linkedin size={13} /></a>}
                  {r.website && <a href={r.website} target="_blank" rel="noreferrer" title="Website" className="p-1.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}><ExternalLink size={13} /></a>}
                  <button onClick={() => addToPipeline(r)} title="Add to pipeline" className="mono text-[10px] uppercase px-2 py-1.5 border flex items-center gap-1" style={{ borderColor: BRAND.blue, color: BRAND.blue }}>
                    <Plus size={12} /> Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ---------- modal ----------

function ContactModal({ form, setForm, onClose, onSave, onDelete }) {
  return (
    <div className="fixed inset-0 flex items-start sm:items-center justify-center p-4 overflow-y-auto z-50" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <div className="border w-full max-w-md my-8" style={{ background: "#0d1210", borderColor: "#2a3330" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#1c2422" }}>
          <h2 className="mono text-xs uppercase tracking-widest">{form.id ? "Edit contact" : "New contact"}</h2>
          <button onClick={onClose} style={{ color: "#8a9290" }}><X size={16} /></button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Name">
              <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="Company / Fund">
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Platform">
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="w-full border px-2 py-1.5 text-sm outline-none" style={inputStyle}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Handle / URL">
              <input value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="@handle or url" className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Type">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full border px-2 py-1.5 text-sm outline-none" style={inputStyle}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Stage focus">
              <select value={form.stageFocus} onChange={(e) => setForm({ ...form, stageFocus: e.target.value })} className="w-full border px-2 py-1.5 text-sm outline-none" style={inputStyle}>
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border px-2 py-1.5 text-sm outline-none" style={inputStyle}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Country">
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Last contact">
              <input type="date" value={form.lastContact} onChange={(e) => setForm({ ...form, lastContact: e.target.value })} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="Next follow-up">
              <input type="date" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Commitment status">
              <select value={form.commitmentStatus} onChange={(e) => setForm({ ...form, commitmentStatus: e.target.value })} className="w-full border px-2 py-1.5 text-sm outline-none" style={inputStyle}>
                {COMMITMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Commitment amount ($)">
              <input type="number" value={form.commitmentAmount} onChange={(e) => setForm({ ...form, commitmentAmount: e.target.value })} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
            </Field>
          </div>

          <Field label="Target close date">
            <input type="date" value={form.targetCloseDate} onChange={(e) => setForm({ ...form, targetCloseDate: e.target.value })} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
          </Field>

          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none resize-none" style={inputStyle} />
          </Field>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "#1c2422" }}>
          {form.id ? (
            <button onClick={() => { onDelete(form.id); onClose(); }} className="mono text-xs uppercase flex items-center gap-1.5" style={{ color: "#ff7a6b" }}>
              <Trash2 size={13} /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="mono text-xs uppercase px-3 py-1.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}>Cancel</button>
            <button onClick={onSave} disabled={!form.name.trim()} className="mono text-xs uppercase px-3 py-1.5" style={{ background: form.name.trim() ? BRAND.blue : "#3a3730", color: "#fff" }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
