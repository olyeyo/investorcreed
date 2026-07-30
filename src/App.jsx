import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Plus, X, Search, Trash2, Pencil, Instagram, Linkedin,
  Mail, Link2, AlertTriangle, Clock, Check, Upload, ExternalLink,
} from "lucide-react";

// ---------- constants ----------

const PLATFORMS = ["Instagram", "LinkedIn", "Twitter/X", "Email", "Other"];
const TYPES = ["Founder", "Angel", "Pre-seed VC", "Seed VC", "Series A+ VC", "Accelerator", "Other"];
const STAGES = ["Pre-seed", "Seed", "Series A", "Growth", "Multi-stage", "N/A"];
const STATUSES = ["Not contacted", "Messaged", "Replied", "Meeting set", "Interested", "Passed"];
const DIR_STAGE_FILTERS = ["Pre-Seed", "Seed", "Early Stage", "Series A", "Series B", "Growth", "Late Stage"];

const STATUS_STYLE = {
  "Not contacted": { fg: "#8a9290", bg: "#161c1a", dot: "#8a9290" },
  "Messaged": { fg: "#ffb000", bg: "#1f1a0a", dot: "#ffb000" },
  "Replied": { fg: "#5ec8d8", bg: "#0a1a1d", dot: "#5ec8d8" },
  "Meeting set": { fg: "#7fe08a", bg: "#0c1a0e", dot: "#7fe08a" },
  "Interested": { fg: "#39ff88", bg: "#0a1f10", dot: "#39ff88" },
  "Passed": { fg: "#ff6b5e", bg: "#1f0c0a", dot: "#ff6b5e" },
};

const PLATFORM_ICON = {
  "Instagram": Instagram,
  "LinkedIn": Linkedin,
  "Twitter/X": Link2,
  "Email": Mail,
  "Other": Link2,
};

const PIPELINE_KEY = "founder-contacts-v1";
const DIRECTORY_KEY = "investor-directory-v1";

const todayStr = () => new Date().toISOString().slice(0, 10);

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
});

// Seeded on first run only. Sophia and Kate from prior outreach drafts, plus a
// short researched list of active pan-African investors compiled from public
// sources (LinkedIn company pages, firm websites, Tracxn) — not scraped,
// hand-verified names to research further and contact manually.
const DEFAULT_CONTACTS = [
  {
    id: crypto.randomUUID(), name: "Sophia Amoruso", company: "Trust Fund", country: "United States",
    platform: "Instagram", handle: "@sophiaamoruso", type: "Angel", stageFocus: "Pre-seed",
    status: "Not contacted", lastContact: "", nextFollowUp: "",
    notes: "Founder & investor at Trust Fund. Built Nasty Gal, invested in 45+ startups. Drafted intro DM.",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(), name: "Kate McAndrew", company: "Baukunst", country: "United States",
    platform: "Instagram", handle: "@kate__mcandrew", type: "Pre-seed VC", stageFocus: "Pre-seed",
    status: "Not contacted", lastContact: "", nextFollowUp: "",
    notes: "Pre-seed VC at Baukunst, $100M fund, SF, invests at frontier of tech + design. Prefers pitches by email: pitch@baukunst.co. Drafted pitch email.",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(), name: "Mike Mompi", company: "Enza Capital", country: "Kenya",
    platform: "LinkedIn", handle: "", type: "Seed VC", stageFocus: "Pre-seed",
    status: "Not contacted", lastContact: "", nextFollowUp: "",
    notes: "Co-founder & Managing Partner, Enza Capital (Nairobi). Multi-stage, pre-seed through Series B on first check. Fintech, logistics, health, human capital, climate-smart. Find LinkedIn handle before outreach.",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(), name: "Lexi Novitske", company: "Norrsken22", country: "Nigeria",
    platform: "LinkedIn", handle: "", type: "Series A+ VC", stageFocus: "Multi-stage",
    status: "Not contacted", lastContact: "", nextFollowUp: "",
    notes: "General Partner, Norrsken22 (Lagos). Prior: Acuity Venture Partners, Singularity Investments. Fintech & enterprise platforms across Africa. Find LinkedIn handle before outreach.",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(), name: "Kola Aina", company: "Ventures Platform", country: "Nigeria",
    platform: "LinkedIn", handle: "", type: "Seed VC", stageFocus: "Seed",
    status: "Not contacted", lastContact: "", nextFollowUp: "",
    notes: "Founding Partner, Ventures Platform Fund (Nigeria). Active early-stage pan-African investor. Find LinkedIn handle before outreach.",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(), name: "Olumide Soyombo", company: "Voltron Capital", country: "Nigeria",
    platform: "LinkedIn", handle: "", type: "Angel", stageFocus: "Pre-seed",
    status: "Not contacted", lastContact: "", nextFollowUp: "",
    notes: "Co-founder, Voltron Capital. Prominent Nigerian angel/early-stage investor. Find LinkedIn handle before outreach.",
    createdAt: new Date().toISOString(),
  },
  {
    id: crypto.randomUUID(), name: "Maya Horgan Famodu", company: "Ingressive Capital", country: "Nigeria",
    platform: "LinkedIn", handle: "", type: "Seed VC", stageFocus: "Seed",
    status: "Not contacted", lastContact: "", nextFollowUp: "",
    notes: "Founder & Managing Partner, Ingressive Capital. Early-stage African tech investor. Find LinkedIn handle before outreach.",
    createdAt: new Date().toISOString(),
  },
];

// ---------- small UI atoms ----------

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 text-[11px] tracking-wide uppercase whitespace-nowrap border transition-colors"
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        borderColor: active ? "#ffb000" : "#2a3330",
        color: active ? "#ffb000" : "#8a9290",
        background: active ? "#1f1a0a" : "transparent",
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
  const [directory, setDirectory] = useState([]);
  const [loadingDirectory, setLoadingDirectory] = useState(true);
  const [directoryError, setDirectoryError] = useState(null);
  const [importing, setImporting] = useState(false);
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

  // ----- load pipeline -----
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(PIPELINE_KEY, false);
        if (res && res.value) setContacts(JSON.parse(res.value));
        else {
          setContacts(DEFAULT_CONTACTS);
          await window.storage.set(PIPELINE_KEY, JSON.stringify(DEFAULT_CONTACTS), false);
        }
      } catch (e) {
        try {
          setContacts(DEFAULT_CONTACTS);
          await window.storage.set(PIPELINE_KEY, JSON.stringify(DEFAULT_CONTACTS), false);
        } catch (e2) {
          setPipelineError("Could not load or initialize saved data.");
        }
      } finally {
        setLoadingPipeline(false);
      }
    })();
  }, []);

  // ----- load directory -----
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(DIRECTORY_KEY, false);
        if (res && res.value) setDirectory(JSON.parse(res.value));
      } catch (e) {
        // no directory imported yet — that's fine
      } finally {
        setLoadingDirectory(false);
      }
    })();
  }, []);

  async function persistPipeline(next) {
    setContacts(next);
    try {
      const res = await window.storage.set(PIPELINE_KEY, JSON.stringify(next), false);
      if (!res) setPipelineError("Save failed — your changes may not persist.");
      else setPipelineError(null);
    } catch (e) {
      setPipelineError("Save failed — your changes may not persist.");
    }
  }

  async function persistDirectory(next) {
    setDirectory(next);
    try {
      const res = await window.storage.set(DIRECTORY_KEY, JSON.stringify(next), false);
      if (!res) setDirectoryError("Save failed — the directory may not persist.");
      else setDirectoryError(null);
    } catch (e) {
      setDirectoryError("Save failed — the directory may not persist.");
    }
  }

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
    return { total, active, overdue, replied };
  }, [contacts]);

  const tickerItems = useMemo(
    () => contacts.filter((c) => isOverdue(c) || isDueToday(c)),
    [contacts]
  );

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
        const av = a.nextFollowUp || "9999";
        const bv = b.nextFollowUp || "9999";
        return av.localeCompare(bv);
      });
  }, [contacts, fType, fStage, fStatus, fPlatform, fCountry, overdueOnly, search]);

  function openAdd() {
    setForm(emptyForm());
    setModalOpen(true);
  }
  function openEdit(c) {
    setForm(c);
    setModalOpen(true);
  }
  function saveForm() {
    if (!form.name.trim()) return;
    if (form.id) persistPipeline(contacts.map((c) => (c.id === form.id ? form : c)));
    else persistPipeline([...contacts, { ...form, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
    setModalOpen(false);
  }
  function removeContact(id) {
    persistPipeline(contacts.filter((c) => c.id !== id));
  }
  function markContactedToday(c) {
    persistPipeline(
      contacts.map((x) =>
        x.id === c.id
          ? { ...x, lastContact: todayStr(), status: x.status === "Not contacted" ? "Messaged" : x.status }
          : x
      )
    );
  }
  function snooze(c, days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    persistPipeline(contacts.map((x) => (x.id === c.id ? { ...x, nextFollowUp: d.toISOString().slice(0, 10) } : x)));
  }

  // ----- directory: import -----
  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setImporting(true);
    setDirectoryError(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const records = rows
        .map((r) => {
          const name = String(r.Investor || r.Name || "").trim();
          if (!name) return null;
          const desc = String(r.Description || "").trim();
          return {
            id: crypto.randomUUID(),
            name,
            rawType: String(r.Type || "").trim(),
            city: String(r.City || "").trim(),
            country: String(r.Country || "").trim(),
            website: String(r.Website || "").trim(),
            linkedin: String(r.LinkedIn || "").trim(),
            email: String(r.ContactEmail || "").trim(),
            stages: String(r.Stages || "").trim(),
            industryFocus: String(r.IndustryFocus || "").trim(),
            geoFocus: String(r.GeographicalFocus || "").trim(),
            minInvestment: Number(r.MinInvestmentSize) || 0,
            maxInvestment: Number(r.MaxInvestmentSize) || 0,
            notes: desc.length > 240 ? desc.slice(0, 240) + "…" : desc,
          };
        })
        .filter(Boolean);

      await persistDirectory(records);
    } catch (err) {
      setDirectoryError("Could not read that file — make sure it's a .xlsx or .csv export with the expected columns.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function clearDirectory() {
    persistDirectory([]);
  }

  function addToPipeline(rec) {
    const stageGuess =
      ["Pre-Seed", "Seed", "Series A", "Growth"].find((s) => rec.stages.includes(s)) || "N/A";
    const typeGuess = /vc|ventures|capital|partners|fund/i.test(rec.rawType + rec.name)
      ? "Seed VC"
      : "Angel";
    const platformGuess = rec.linkedin ? "LinkedIn" : rec.email ? "Email" : "Other";
    const handleGuess = rec.linkedin || rec.email || rec.website;

    const newContact = {
      id: crypto.randomUUID(),
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
        rec.minInvestment || rec.maxInvestment
          ? `Check size: $${rec.minInvestment.toLocaleString()}–$${rec.maxInvestment.toLocaleString()}`
          : "",
        rec.notes,
      ].filter(Boolean).join(" · "),
      createdAt: new Date().toISOString(),
    };
    persistPipeline([...contacts, newContact]);
    setAddedFlash(rec.id);
    setTimeout(() => setAddedFlash(null), 1500);
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
      .slice(0, 300); // render cap for performance; filters narrow the rest
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
        @keyframes flash-in { 0% { background: #1f1a0a; } 100% { background: transparent; } }
        .flash { animation: flash-in 1.4s ease-out; }
      `}</style>

      {/* top bar */}
      <div className="border-b" style={{ borderColor: "#1c2422" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full" style={{ background: "#39ff88" }} />
            <h1 className="mono text-sm tracking-[0.2em] uppercase">Outreach Terminal</h1>
          </div>
          <div className="mono text-xs flex items-center gap-4" style={{ color: "#8a9290" }}>
            <span>{clockStr}</span>
            <span>|</span>
            <span>TRACKED <b style={{ color: "#e8e6d9" }}>{stats.total}</b></span>
            <span>ACTIVE <b style={{ color: "#7fe08a" }}>{stats.active}</b></span>
            <span>REPLIED <b style={{ color: "#5ec8d8" }}>{stats.replied}</b></span>
            <span>OVERDUE <b style={{ color: stats.overdue ? "#ff6b5e" : "#8a9290" }}>{stats.overdue}</b></span>
          </div>
        </div>
        {/* menu / tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1 -mb-px">
          {[
            { id: "pipeline", label: "Pipeline" },
            { id: "directory", label: `Investor Directory${directory.length ? ` (${directory.length})` : ""}` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="mono text-[11px] uppercase tracking-widest px-3 py-2 border-b-2"
              style={{
                borderColor: tab === t.id ? "#ffb000" : "transparent",
                color: tab === t.id ? "#ffb000" : "#8a9290",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ticker (pipeline follow-ups) */}
      <div className={"overflow-hidden border-b " + (reduceMotion.current ? "no-motion" : "")} style={{ borderColor: "#1c2422", background: "#0d1210" }}>
        <div className="py-1.5 whitespace-nowrap">
          {tickerItems.length === 0 ? (
            <div className="mono text-[11px] px-4" style={{ color: "#4d5652" }}>— no follow-ups due —</div>
          ) : (
            <div className="ticker-track inline-flex">
              {[...tickerItems, ...tickerItems].map((c, i) => (
                <span key={i} className="mono text-[11px] px-4 inline-flex items-center gap-1.5" style={{ color: isOverdue(c) ? "#ff6b5e" : "#ffb000" }}>
                  <AlertTriangle size={11} />
                  {c.name} · {c.nextFollowUp} · follow up
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

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
            clearDirectory={clearDirectory}
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
    fPlatform, setFPlatform, fCountry, setFCountry, countryOptions, overdueOnly, setOverdueOnly,
    openAdd, loading, filtered, contactsLength, isOverdue, isDueToday,
    markContactedToday, snooze, openEdit, removeContact,
  } = props;

  return (
    <>
      {error && (
        <div className="mono text-xs mb-4 px-3 py-2 border" style={{ borderColor: "#ff6b5e", color: "#ff6b5e" }}>{error}</div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-2 px-2.5 py-1.5 border flex-1 min-w-[200px]" style={{ borderColor: "#2a3330" }}>
          <Search size={14} color="#8a9290" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search name, company, notes..."
            className="bg-transparent outline-none text-sm flex-1"
            style={{ color: "#e8e6d9" }}
          />
        </div>
        <button onClick={openAdd} className="mono text-xs uppercase tracking-wide px-3 py-2 flex items-center gap-1.5" style={{ background: "#ffb000", color: "#0a0e0c" }}>
          <Plus size={14} /> Add contact
        </button>
      </div>

      <FilterRow label="Type" value={fType} setValue={setFType} options={TYPES} />
      <FilterRow label="Stage" value={fStage} setValue={setFStage} options={STAGES} />
      <FilterRow label="Status" value={fStatus} setValue={setFStatus} options={STATUSES} />
      <FilterRow label="Platform" value={fPlatform} setValue={setFPlatform} options={PLATFORMS} />
      {countryOptions.length > 0 && <FilterRow label="Country" value={fCountry} setValue={setFCountry} options={countryOptions} />}
      <div className="flex flex-wrap gap-1.5 mb-5">
        <Chip active={overdueOnly} onClick={() => setOverdueOnly((v) => !v)}>Due / overdue only</Chip>
      </div>

      {loading ? (
        <div className="mono text-sm" style={{ color: "#8a9290" }}>loading...</div>
      ) : filtered.length === 0 ? (
        <div className="border py-14 text-center" style={{ borderColor: "#1c2422" }}>
          <p className="mono text-sm mb-1" style={{ color: "#8a9290" }}>
            {contactsLength === 0 ? "no contacts tracked yet" : "nothing matches these filters"}
          </p>
          <p className="text-sm" style={{ color: "#4d5652" }}>
            {contactsLength === 0 ? "add the first founder or investor to start your pipeline" : "try clearing a filter"}
          </p>
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
                    <div className="mono text-[11px]" style={{ color: "#8a9290" }}>
                      {c.company ? c.company + " · " : ""}{c.handle || "no handle yet"}
                    </div>
                  </div>
                </div>
                <span className="mono text-[10px] uppercase px-2 py-0.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}>{c.type}</span>
                <span className="mono text-[10px] uppercase px-2 py-0.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}>{c.stageFocus}</span>
                {c.country && <span className="mono text-[10px] uppercase px-2 py-0.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}>{c.country}</span>}
                <StatusBadge status={c.status} />
                <div className="mono text-[11px]" style={{ color: overdue ? "#ff6b5e" : dueToday ? "#ffb000" : "#8a9290" }}>
                  {c.nextFollowUp ? `next: ${c.nextFollowUp}` : "no follow-up set"}
                  {overdue && " (overdue)"}
                  {dueToday && " (today)"}
                </div>
                {c.notes && (
                  <div className="text-xs italic flex-1 min-w-[140px]" style={{ color: "#6b756f" }} title={c.notes}>
                    {c.notes.length > 60 ? c.notes.slice(0, 60) + "…" : c.notes}
                  </div>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  <button onClick={() => markContactedToday(c)} title="Mark contacted today" className="p-1.5 border" style={{ borderColor: "#2a3330", color: "#7fe08a" }}><Check size={13} /></button>
                  <button onClick={() => snooze(c, 7)} title="Follow up in 7 days" className="p-1.5 border" style={{ borderColor: "#2a3330", color: "#ffb000" }}><Clock size={13} /></button>
                  <button onClick={() => openEdit(c)} title="Edit" className="p-1.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}><Pencil size={13} /></button>
                  <button onClick={() => removeContact(c.id)} title="Delete" className="p-1.5 border" style={{ borderColor: "#2a3330", color: "#ff6b5e" }}><Trash2 size={13} /></button>
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
      {options.map((o) => (
        <Chip key={o} active={value === o} onClick={() => setValue(o)}>{o}</Chip>
      ))}
    </div>
  );
}

// ---------- Directory tab ----------

function DirectoryTab(props) {
  const {
    error, importing, fileInputRef, handleFile, clearDirectory, directory, loading,
    dirSearch, setDirSearch, dirStage, setDirStage, dirCountry, setDirCountry,
    dirIndustry, setDirIndustry, dirCheckSize, setDirCheckSize, directoryFiltered,
    addToPipeline, addedFlash,
  } = props;

  return (
    <>
      <div className="mb-4 border p-3" style={{ borderColor: "#1c2422", background: "#0d1210" }}>
        <p className="text-sm mb-2" style={{ color: "#8a9290" }}>
          Import a spreadsheet of investors (.xlsx or .csv) — expects columns like{" "}
          <span className="mono text-[11px]">Investor, Type, Country, Website, LinkedIn, ContactEmail, Stages, IndustryFocus, GeographicalFocus, MinInvestmentSize, MaxInvestmentSize</span>.
          Parsing happens in your browser — the file isn't sent anywhere else.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            disabled={importing}
            className="mono text-xs uppercase tracking-wide px-3 py-2 flex items-center gap-1.5"
            style={{ background: "#ffb000", color: "#0a0e0c" }}
          >
            <Upload size={14} /> {importing ? "Importing..." : "Import spreadsheet"}
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
          {directory.length > 0 && (
            <button onClick={clearDirectory} className="mono text-xs uppercase px-3 py-2 border" style={{ borderColor: "#2a3330", color: "#ff6b5e" }}>
              Clear directory ({directory.length})
            </button>
          )}
        </div>
        {error && <div className="mono text-xs mt-2" style={{ color: "#ff6b5e" }}>{error}</div>}
      </div>

      {loading ? (
        <div className="mono text-sm" style={{ color: "#8a9290" }}>loading...</div>
      ) : directory.length === 0 ? (
        <div className="border py-14 text-center" style={{ borderColor: "#1c2422" }}>
          <p className="mono text-sm mb-1" style={{ color: "#8a9290" }}>no directory imported yet</p>
          <p className="text-sm" style={{ color: "#4d5652" }}>import a spreadsheet above to build a searchable, filterable investor list</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="flex items-center gap-2 px-2.5 py-1.5 border flex-1 min-w-[180px]" style={{ borderColor: "#2a3330" }}>
              <Search size={14} color="#8a9290" />
              <input value={dirSearch} onChange={(e) => setDirSearch(e.target.value)} placeholder="search name, industry, geography..." className="bg-transparent outline-none text-sm flex-1" style={{ color: "#e8e6d9" }} />
            </div>
            <input value={dirCountry} onChange={(e) => setDirCountry(e.target.value)} placeholder="country contains..." className="bg-transparent border px-2.5 py-1.5 text-sm outline-none w-40" style={inputStyle} />
            <input value={dirIndustry} onChange={(e) => setDirIndustry(e.target.value)} placeholder="industry contains..." className="bg-transparent border px-2.5 py-1.5 text-sm outline-none w-40" style={inputStyle} />
            <input value={dirCheckSize} onChange={(e) => setDirCheckSize(e.target.value)} type="number" placeholder="my check size ($)" className="bg-transparent border px-2.5 py-1.5 text-sm outline-none w-36" style={inputStyle} />
          </div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            <span className="mono text-[10px] uppercase self-center mr-1" style={{ color: "#4d5652" }}>Stage</span>
            <Chip active={dirStage === "All"} onClick={() => setDirStage("All")}>All</Chip>
            {DIR_STAGE_FILTERS.map((s) => (
              <Chip key={s} active={dirStage === s} onClick={() => setDirStage(s)}>{s}</Chip>
            ))}
          </div>

          <div className="mono text-[11px] mb-2" style={{ color: "#4d5652" }}>
            showing {directoryFiltered.length} of {directory.length} {directoryFiltered.length === 300 ? "(narrow filters to see more)" : ""}
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
                <div className="flex items-center gap-1 ml-auto">
                  {r.linkedin && (
                    <a href={r.linkedin} target="_blank" rel="noreferrer" title="LinkedIn" className="p-1.5 border" style={{ borderColor: "#2a3330", color: "#5ec8d8" }}><Linkedin size={13} /></a>
                  )}
                  {r.website && (
                    <a href={r.website} target="_blank" rel="noreferrer" title="Website" className="p-1.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}><ExternalLink size={13} /></a>
                  )}
                  <button onClick={() => addToPipeline(r)} title="Add to pipeline" className="mono text-[10px] uppercase px-2 py-1.5 border flex items-center gap-1" style={{ borderColor: "#ffb000", color: "#ffb000" }}>
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="Company / Fund">
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Platform">
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="w-full border px-2 py-1.5 text-sm outline-none" style={inputStyle}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Handle / URL">
              <input value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="@handle or url" className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border px-2 py-1.5 text-sm outline-none" style={inputStyle}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Country">
              <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Last contact">
              <input type="date" value={form.lastContact} onChange={(e) => setForm({ ...form, lastContact: e.target.value })} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
            </Field>
            <Field label="Next follow-up">
              <input type="date" value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none" style={inputStyle} />
            </Field>
          </div>

          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full bg-transparent border px-2 py-1.5 text-sm outline-none resize-none" style={inputStyle} />
          </Field>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: "#1c2422" }}>
          {form.id ? (
            <button onClick={() => { onDelete(form.id); onClose(); }} className="mono text-xs uppercase flex items-center gap-1.5" style={{ color: "#ff6b5e" }}>
              <Trash2 size={13} /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose} className="mono text-xs uppercase px-3 py-1.5 border" style={{ borderColor: "#2a3330", color: "#8a9290" }}>Cancel</button>
            <button onClick={onSave} disabled={!form.name.trim()} className="mono text-xs uppercase px-3 py-1.5" style={{ background: form.name.trim() ? "#ffb000" : "#3a3730", color: "#0a0e0c" }}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
