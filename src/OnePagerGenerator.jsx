import React, { useState } from 'react';
import { Plus, X, Printer, Copy, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Suckmill — One-Pager / Teaser Generator
//
// Drop this file in as src/OnePagerGenerator.jsx and add it as a third tab
// next to PIPELINE / INVESTOR DIRECTORY (see integration notes at the bottom
// of this file). Editor matches your existing dark terminal UI; the
// generated document is its own light, print-ready artifact — investors
// receive a clean memo, not a screenshot of your dashboard.
// ---------------------------------------------------------------------------

const DEFAULT_STATE = {
  companyName: 'ORI',
  tagline: 'Verified short-let listings for Nigerian travelers',
  oneLiner:
    'ORI lets travelers book vetted short-let apartments in Lagos and Abuja without the fake-listing risk that plagues informal channels.',
  problem:
    'Nigerian short-let listings are scattered across WhatsApp groups and Instagram, with no verification — travelers routinely lose deposits to fake listings.',
  solution:
    'ORI verifies every property in person before listing, escrows payment until check-in, and gives hosts a booking calendar that ends double-bookings.',
  stage: 'Pre-seed',
  ask: '100000',
  useOfFunds: 'Property verification team, payment escrow integration, 18-month runway to Series A metrics.',
  metrics: {
    mrr: '4200',
    growthPct: '22',
    burn: '6800',
    runwayMonths: '9',
    tam: '1200000000',
  },
  team: [
    { name: 'Founder Name', role: 'CEO — ex-Paystack' },
    { name: 'Cofounder Name', role: 'CTO — ex-Flutterwave' },
  ],
  contactEmail: 'founder@ori.africa',
  website: 'ori.africa',
};

function fmtMoney(v) {
  const n = Number(v);
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
}

export default function OnePagerGenerator() {
  const [data, setData] = useState(DEFAULT_STATE);
  const [copied, setCopied] = useState(false);

  const set = (path, value) => {
    setData((prev) => {
      const next = { ...prev };
      if (path[0] === 'metrics') {
        next.metrics = { ...prev.metrics, [path[1]]: value };
      } else {
        next[path[0]] = value;
      }
      return next;
    });
  };

  const updateTeamMember = (i, field, value) => {
    setData((prev) => {
      const team = [...prev.team];
      team[i] = { ...team[i], [field]: value };
      return { ...prev, team };
    });
  };

  const addTeamMember = () =>
    setData((prev) => ({ ...prev, team: [...prev.team, { name: '', role: '' }] }));

  const removeTeamMember = (i) =>
    setData((prev) => ({ ...prev, team: prev.team.filter((_, idx) => idx !== i) }));

  const handlePrint = () => window.print();

  const handleCopyLink = async () => {
    // Placeholder: if you persist one-pagers to Supabase, swap this for a
    // real shareable URL (e.g. /teaser/:id) instead of copying nothing.
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <div className="min-h-screen bg-black text-gray-300 font-mono">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #one-pager, #one-pager * { visibility: visible; }
          #one-pager {
            position: absolute; top: 0; left: 0; width: 100%;
            box-shadow: none; border: none;
          }
          @page { size: Letter; margin: 0.6in; }
        }
      `}</style>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] min-h-screen">
        {/* ---------- EDITOR (matches dark terminal UI) ---------- */}
        <div className="border-r border-gray-800 p-6 space-y-6 overflow-y-auto max-h-screen no-print">
          <div>
            <div className="text-xs uppercase tracking-widest text-gray-500 mb-3">
              One-Pager Generator
            </div>
            <Field label="Company name" value={data.companyName} onChange={(v) => set(['companyName'], v)} />
            <Field label="Tagline" value={data.tagline} onChange={(v) => set(['tagline'], v)} />
            <TextArea label="One-liner" value={data.oneLiner} onChange={(v) => set(['oneLiner'], v)} />
          </div>

          <Section title="Problem / Solution">
            <TextArea label="Problem" value={data.problem} onChange={(v) => set(['problem'], v)} />
            <TextArea label="Solution" value={data.solution} onChange={(v) => set(['solution'], v)} />
          </Section>

          <Section title="Metrics">
            <div className="grid grid-cols-2 gap-3">
              <Field label="MRR ($)" value={data.metrics.mrr} onChange={(v) => set(['metrics', 'mrr'], v)} />
              <Field label="MoM growth (%)" value={data.metrics.growthPct} onChange={(v) => set(['metrics', 'growthPct'], v)} />
              <Field label="Monthly burn ($)" value={data.metrics.burn} onChange={(v) => set(['metrics', 'burn'], v)} />
              <Field label="Runway (months)" value={data.metrics.runwayMonths} onChange={(v) => set(['metrics', 'runwayMonths'], v)} />
              <Field label="TAM ($)" value={data.metrics.tam} onChange={(v) => set(['metrics', 'tam'], v)} className="col-span-2" />
            </div>
          </Section>

          <Section title="The ask">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stage" value={data.stage} onChange={(v) => set(['stage'], v)} />
              <Field label="Raising ($)" value={data.ask} onChange={(v) => set(['ask'], v)} />
            </div>
            <TextArea label="Use of funds" value={data.useOfFunds} onChange={(v) => set(['useOfFunds'], v)} />
          </Section>

          <Section title="Team">
            {data.team.map((member, i) => (
              <div key={i} className="flex gap-2 mb-2 items-start">
                <div className="flex-1 space-y-1">
                  <input
                    className="w-full bg-gray-950 border border-gray-800 px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-[#006DDB]"
                    placeholder="Name"
                    value={member.name}
                    onChange={(e) => updateTeamMember(i, 'name', e.target.value)}
                  />
                  <input
                    className="w-full bg-gray-950 border border-gray-800 px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-[#006DDB]"
                    placeholder="Role"
                    value={member.role}
                    onChange={(e) => updateTeamMember(i, 'role', e.target.value)}
                  />
                </div>
                <button
                  onClick={() => removeTeamMember(i)}
                  className="text-gray-600 hover:text-red-400 mt-1"
                  aria-label="Remove team member"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={addTeamMember}
              className="flex items-center gap-1 text-xs uppercase tracking-wide text-[#006DDB] hover:text-[#C7A05F] mt-1"
            >
              <Plus size={12} /> Add team member
            </button>
          </Section>

          <Section title="Contact">
            <Field label="Email" value={data.contactEmail} onChange={(v) => set(['contactEmail'], v)} />
            <Field label="Website" value={data.website} onChange={(v) => set(['website'], v)} />
          </Section>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-[#006DDB] hover:bg-[#0058b3] text-white text-sm px-4 py-2 uppercase tracking-wide"
            >
              <Printer size={14} /> Export PDF
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 border border-gray-700 hover:border-gray-500 text-gray-300 text-sm px-4 py-2 uppercase tracking-wide"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>

        {/* ---------- PREVIEW / PRINT DOCUMENT ---------- */}
        <div className="p-8 overflow-y-auto max-h-screen bg-gray-950 flex justify-center no-print-bg">
          <OnePagerDocument data={data} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The actual investor-facing document. Own visual identity, deliberately not
// a copy of the app chrome: paper-white, serif headline, monospace ledger
// strip for the metrics — reads like a term sheet, not a slide.
// ---------------------------------------------------------------------------
function OnePagerDocument({ data }) {
  const m = data.metrics;
  return (
    <div
      id="one-pager"
      className="bg-[#FAF9F6] text-[#1A1A1A] shadow-2xl"
      style={{
        width: '8.5in',
        minHeight: '11in',
        padding: '0.65in',
        fontFamily: "'Georgia', 'Times New Roman', serif",
      }}
    >
      {/* Header */}
      <div className="flex justify-between items-end border-b-2 border-[#1A1A1A] pb-4 mb-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
            {data.companyName || 'Company'}
          </h1>
          <p className="text-base italic text-[#555] mt-1">{data.tagline}</p>
        </div>
        <div
          className="text-right text-xs uppercase tracking-widest text-[#555]"
          style={{ fontFamily: "'Courier New', monospace" }}
        >
          <div>{data.stage}</div>
          <div>Raising {fmtMoney(data.ask)}</div>
        </div>
      </div>

      {/* One-liner */}
      <p className="text-lg leading-relaxed mb-6">{data.oneLiner}</p>

      {/* Metrics ledger — the signature element */}
      <div
        className="border-t border-b border-[#1A1A1A] py-3 mb-6 grid grid-cols-5 text-center"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <Metric label="MRR" value={fmtMoney(m.mrr)} />
        <Metric label="MoM Growth" value={`${m.growthPct || 0}%`} />
        <Metric label="Burn / mo" value={fmtMoney(m.burn)} />
        <Metric label="Runway" value={`${m.runwayMonths || '—'} mo`} />
        <Metric label="TAM" value={fmtMoney(m.tam)} />
      </div>

      {/* Problem / Solution */}
      <div className="grid grid-cols-2 gap-8 mb-6">
        <div>
          <h2 className="text-xs uppercase tracking-widest text-[#555] mb-2 border-b border-[#ccc] pb-1">
            Problem
          </h2>
          <p className="text-sm leading-relaxed">{data.problem}</p>
        </div>
        <div>
          <h2 className="text-xs uppercase tracking-widest text-[#555] mb-2 border-b border-[#ccc] pb-1">
            Solution
          </h2>
          <p className="text-sm leading-relaxed">{data.solution}</p>
        </div>
      </div>

      {/* Ask */}
      <div className="bg-[#1A1A1A] text-[#FAF9F6] px-5 py-4 mb-6">
        <h2 className="text-xs uppercase tracking-widest text-[#ccc] mb-1">Use of funds</h2>
        <p className="text-sm leading-relaxed">{data.useOfFunds}</p>
      </div>

      {/* Team */}
      <div className="mb-6">
        <h2 className="text-xs uppercase tracking-widest text-[#555] mb-2 border-b border-[#ccc] pb-1">
          Team
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {data.team.map((t, i) => (
            <div key={i} className="text-sm">
              <span className="font-bold">{t.name}</span>
              {t.role ? <span className="text-[#555]"> — {t.role}</span> : null}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        className="border-t border-[#1A1A1A] pt-3 mt-auto flex justify-between text-xs text-[#555]"
        style={{ fontFamily: "'Courier New', monospace" }}
      >
        <span>{data.contactEmail}</span>
        <span>{data.website}</span>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-[#555] mt-0.5">{label}</div>
    </div>
  );
}

function Field({ label, value, onChange, className = '' }) {
  return (
    <div className={`mb-2 ${className}`}>
      <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">{label}</label>
      <input
        className="w-full bg-gray-950 border border-gray-800 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-[#006DDB]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function TextArea({ label, value, onChange }) {
  return (
    <div className="mb-2">
      <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">{label}</label>
      <textarea
        rows={3}
        className="w-full bg-gray-950 border border-gray-800 px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-[#006DDB] resize-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-gray-500 mb-2 border-b border-gray-800 pb-1">
        {title}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// INTEGRATION NOTES
//
// 1. npm install lucide-react   (skip if already a dependency)
// 2. Save this file as src/OnePagerGenerator.jsx
// 3. In src/App.jsx, add a third tab alongside PIPELINE / INVESTOR DIRECTORY:
//
//      import OnePagerGenerator from './OnePagerGenerator';
//      ...
//      {activeTab === 'onepager' && <OnePagerGenerator />}
//
//    and a tab button: <button onClick={() => setActiveTab('onepager')}>ONE-PAGER</button>
//
// 4. "Export PDF" uses the browser's native print-to-PDF (window.print()) —
//    no extra dependency, and it respects the @media print rules above so
//    only #one-pager renders, at Letter size. If you'd rather have a direct
//    "Download PDF" button with no print dialog, install html2canvas +
//    jspdf and swap handlePrint for a canvas-capture routine — say the word
//    and I'll wire that up.
//
// 5. To let founders save/reuse drafts across sessions, persist `data` to a
//    new Supabase table (e.g. `one_pagers`, RLS-scoped like your other
//    tables) on a debounce, and load it on mount. Not included here to keep
//    this a drop-in component with no schema changes required yet.
// ---------------------------------------------------------------------------
