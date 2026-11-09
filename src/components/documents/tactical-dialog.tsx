"use client";

import { ListPlus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getTacticalRefs } from "@/app/(app)/documents/actions";
import { Select } from "@/components/ui/select";
import { renderTactical, tacticalLabels } from "@/lib/documents/render-tactical";
import {
  cleanTacticalSheet,
  emptyStation,
  emptySupport,
  emptyTacticalSheet,
  HELMETS,
  TACTICAL_LIMITS,
  type Airbase,
  type Station,
  type SupportUnit,
  type TacticalRefs,
  type TacticalSheet,
  withWingmenTacan,
} from "@/lib/documents/tactical";
import { useT } from "@/lib/i18n/client";
import { uuid } from "@/lib/uuid";
import type { CreatedPage } from "./create-pages";
import { TacticalRefsDialog } from "./tactical-refs-dialog";
import { Field, RamrodInputs, Rows, Section } from "./tactical-fields";

type Role = keyof TacticalSheet["airbases"];

/**
 * Fiche tactique (« mission card ») : mission, terrains, patrouille, emports,
 * radios, objectifs, notes de vol. Terrains et stations radio se choisissent
 * dans les listes du pilote (« Gérer mes listes »), puis restent modifiables.
 */
export function TacticalDialog({
  initial,
  onClose,
  onCreate,
}: {
  /** Modification : contenu actuel */
  initial?: { title: string; data: TacticalSheet };
  onClose: () => void;
  onCreate: (items: CreatedPage[]) => void | Promise<void>;
}) {
  const t = useT().documents.create;
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [sheet, setSheet] = useState<TacticalSheet>(() => initial?.data ?? emptyTacticalSheet());
  const [refs, setRefs] = useState<TacticalRefs | null>(null);
  const [refsOpen, setRefsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  useEffect(() => {
    let alive = true;
    getTacticalRefs()
      .then((r) => alive && setRefs(r))
      .catch(() => alive && setRefs({ airbases: [], stations: [], support: [] }));
    return () => {
      alive = false;
    };
  }, []);

  const update = (fn: (s: TacticalSheet) => TacticalSheet) => setSheet((prev) => fn(prev));
  const setHeader = (key: keyof TacticalSheet["header"], value: string) =>
    update((s) => ({ ...s, header: { ...s.header, [key]: value } }));
  const setAirbase = (role: Role, value: Airbase) =>
    update((s) => ({ ...s, airbases: { ...s.airbases, [role]: value } }));
  const setStation = (com: "com1" | "com2", i: number, value: Station) =>
    update((s) => ({ ...s, [com]: s[com].map((st, j) => (j === i ? value : st)) }));
  const setListRow = <L extends "flight" | "targets">(list: L, i: number, key: keyof TacticalSheet[L][number], value: string) =>
    update((s) => ({ ...s, [list]: s[list].map((r, j) => (j === i ? { ...r, [key]: value } : r)) }));

  async function create() {
    const name = title.trim().slice(0, 120) || sheet.header.mission.trim() || t.tacticalDefaultTitle;
    const clean = cleanTacticalSheet(sheet);
    setWorking(true);
    setError(null);
    try {
      const files = await renderTactical(name, clean, tacticalLabels(t));
      const group = uuid();
      await onCreate(
        files.map((file, i) => ({
          file,
          name: file.name.replace(/\.png$/, ""),
          source: { kind: "tactical", title: name, group, part: i + 1, ...clean },
        })),
      );
      setWorking(false);
    } catch {
      setError(t.failed);
      setWorking(false);
    }
  }

  const airbaseOptions = (refs?.airbases ?? []).map((a, i) => ({ value: String(i), label: [a.name, a.tacan].filter(Boolean).join(" · ") }));
  const supportOptions = (refs?.support ?? []).map((u, i) => ({
    value: String(i),
    label: [u.callsign, u.type, u.notes].filter(Boolean).join(" · "),
  }));
  const setSupport = (i: number, value: SupportUnit) =>
    update((s) => ({ ...s, support: s.support.map((u, j) => (j === i ? value : u)) }));
  const stationOptions = (refs?.stations ?? []).map((s, i) => ({ value: String(i), label: [s.code, s.name].filter(Boolean).join(" · ") }));
  const wingmen = withWingmenTacan(sheet.flight);
  const noRefs = refs !== null && !refs.airbases.length && !refs.stations.length;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="tactical-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(64rem,calc(100vw-2rem))] rounded-[4px] bg-overlay p-0 text-fg shadow-popover backdrop:bg-black/60"
    >
      <form
        className="space-y-5 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="tactical-title" className="text-lg font-medium">
            {initial ? t.editTacticalTitle : t.tacticalDialogTitle}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn-secondary min-h-9 px-3 text-sm"
              disabled={refs === null}
              onClick={() => setRefsOpen(true)}
            >
              <ListPlus size={16} strokeWidth={1.75} />
              {t.manageLists}
            </button>
            <button type="button" className="btn-icon -mr-2" aria-label={t.close} onClick={onClose}>
              <X size={18} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <p className="text-xs text-subtle">{t.tacticalHint}</p>
        {refs === null && <p className="text-xs text-muted">{t.refsLoading}</p>}
        {noRefs && <p className="text-xs text-muted">{t.refsNone}</p>}

        <label className="flex flex-col gap-1.5 text-sm text-muted">
          {t.titleLabel}
          <input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <Section title={t.sectionMission}>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-6">
            <Labeled label="Callsign">
              <Field label="Callsign" value={sheet.header.callsign} onChange={(v) => setHeader("callsign", v)} />
            </Labeled>
            <Labeled label="PRI">
              <Field label="PRI" value={sheet.header.pri} onChange={(v) => setHeader("pri", v)} />
            </Labeled>
            <Labeled label="AUX">
              <Field label="AUX" value={sheet.header.aux} onChange={(v) => setHeader("aux", v)} />
            </Labeled>
            <Labeled label="Mission">
              <Field label="Mission" value={sheet.header.mission} onChange={(v) => setHeader("mission", v)} />
            </Labeled>
            <Labeled label={t.weather}>
              <Field label={t.weather} value={sheet.header.weather} onChange={(v) => setHeader("weather", v)} />
            </Labeled>
            <Labeled label={t.timeZ}>
              <Field label={t.timeZ} value={sheet.header.time} onChange={(v) => setHeader("time", v)} mono />
            </Labeled>
          </div>
        </Section>

        <Section title={t.sectionAirbase}>
          <Wide>
            <GridHead cols={AIRBASE_COLS} labels={["", t.chooseAirbase, t.colBase, "TCN", "VHF", "UHF", t.colElev, t.colRunway, "ILS"]} />
            {(["dep", "arr", "alt"] as const).map((role) => {
              const a = sheet.airbases[role];
              const set = (key: keyof Airbase) => (v: string) => setAirbase(role, { ...a, [key]: v });
              const label = role === "dep" ? "DEP" : role === "arr" ? "ARR" : "ALTN";
              return (
                <div key={role} className="grid items-center gap-1.5" style={{ gridTemplateColumns: AIRBASE_COLS }}>
                  <span className="numeric text-sm font-semibold text-muted">{label}</span>
                  <Select
                    label={`${t.chooseAirbase} ${label}`}
                    size="sm"
                    value=""
                    placeholder={t.chooseAirbase}
                    options={airbaseOptions}
                    disabled={!airbaseOptions.length}
                    onChange={(v) => {
                      const picked = refs?.airbases[Number(v)];
                      if (picked) setAirbase(role, { ...picked });
                    }}
                  />
                  <Field label={`${t.colBase} ${label}`} value={a.name} onChange={set("name")} />
                  <Field label={`TCN ${label}`} value={a.tacan} onChange={set("tacan")} mono />
                  <Field label={`VHF ${label}`} value={a.vhf} onChange={set("vhf")} mono />
                  <Field label={`UHF ${label}`} value={a.uhf} onChange={set("uhf")} mono />
                  <Field label={`${t.colElev} ${label}`} value={a.elev} onChange={set("elev")} mono />
                  <Field label={`${t.colRunway} ${label}`} value={a.runway} onChange={set("runway")} mono />
                  <Field label={`ILS ${label}`} value={a.ils} onChange={set("ils")} mono />
                </div>
              );
            })}
          </Wide>
        </Section>

        <Section title={t.sectionFlight}>
          <Wide>
            <GridHead cols={FLIGHT_COLS} labels={["#", t.colPilot, t.colHelmet, "TCN", "LSR", "STN", t.colTail, t.colNotes]} />
            {sheet.flight.map((m, i) => (
              <div key={i} className="grid items-center gap-1.5" style={{ gridTemplateColumns: FLIGHT_COLS }}>
                <span className="numeric text-sm font-semibold text-muted">{i + 1}</span>
                <Field label={`${t.colPilot} ${i + 1}`} value={m.pilot} onChange={(v) => setListRow("flight", i, "pilot", v)} />
                <Select
                  label={`${t.colHelmet} ${i + 1}`}
                  size="sm"
                  value={m.helmet}
                  placeholder="—"
                  options={helmetOptions(m.helmet)}
                  onChange={(v) => setListRow("flight", i, "helmet", v)}
                />
                {i === 0 ? (
                  <Field label={`TCN ${i + 1}`} value={m.tacan} onChange={(v) => setListRow("flight", i, "tacan", v)} mono />
                ) : (
                  // Ailiers : TACAN du leader + 63, calculé.
                  <Field label={`TCN ${i + 1}`} value={wingmen[i].tacan} onChange={() => {}} mono readOnly />
                )}
                <Field label={`LSR ${i + 1}`} value={m.laser} onChange={(v) => setListRow("flight", i, "laser", v)} mono />
                <Field label={`STN ${i + 1}`} value={m.stn} onChange={(v) => setListRow("flight", i, "stn", v)} mono />
                <Field label={`${t.colTail} ${i + 1}`} value={m.tail} onChange={(v) => setListRow("flight", i, "tail", v)} mono />
                <Field label={`${t.colNotes} ${i + 1}`} value={m.notes} onChange={(v) => setListRow("flight", i, "notes", v)} />
              </div>
            ))}
          </Wide>
          <p className="text-xs text-subtle">{t.tacanHint}</p>
        </Section>

        <Section title={t.sectionLoadout}>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {(
              [
                ["aa", "A/A"],
                ["ag", "A/G"],
                ["pod", "POD"],
                ["tanks", "TANKS"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-1.5">
                <span className="numeric text-sm font-semibold text-muted">{label}</span>
                <Field
                  label={label}
                  value={sheet.loadout[key]}
                  onChange={(v) => update((s) => ({ ...s, loadout: { ...s.loadout, [key]: v } }))}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section title={t.sectionCom}>
          <div className="grid gap-4 lg:grid-cols-2">
            {(["com1", "com2"] as const).map((com) => (
              <div key={com} className="space-y-1.5">
                <div className="numeric text-sm font-semibold text-muted">{com === "com1" ? "COM1 (PRI)" : "COM2 (AUX)"}</div>
                <GridHead cols={COM_COLS} labels={["", t.colChannel, t.colFreq, t.colName, ""]} />
                {sheet[com].map((st, i) => {
                  const set = (key: keyof Station) => (v: string) => setStation(com, i, { ...st, [key]: v });
                  const label = `${com === "com1" ? "COM1" : "COM2"} ${i + 1}`;
                  return (
                    <div key={i} className="grid items-center gap-1.5" style={{ gridTemplateColumns: COM_COLS }}>
                      <Select
                        label={`${t.chooseStation} ${label}`}
                        size="sm"
                        value=""
                        placeholder={t.chooseStation}
                        options={stationOptions}
                        disabled={!stationOptions.length}
                        onChange={(v) => {
                          const picked = refs?.stations[Number(v)];
                          if (picked) setStation(com, i, { ...picked });
                        }}
                      />
                      <Field label={`${t.colChannel} ${label}`} value={st.code} onChange={set("code")} mono />
                      <Field label={`${t.colFreq} ${label}`} value={st.freq} onChange={set("freq")} mono />
                      <Field label={`${t.colName} ${label}`} value={st.name} onChange={set("name")} />
                      <RemoveRow
                        label={`${t.removeRow} ${label}`}
                        onClick={() => update((s) => ({ ...s, [com]: s[com].filter((_, j) => j !== i) }))}
                      />
                    </div>
                  );
                })}
                {sheet[com].length < TACTICAL_LIMITS.com && (
                  <AddRow label={t.addRow} onClick={() => update((s) => ({ ...s, [com]: [...s[com], emptyStation()] }))} />
                )}
              </div>
            ))}
          </div>
        </Section>

        <Section title={t.sectionTargets}>
          <Wide>
            <GridHead cols={TARGET_COLS} labels={["N°", t.colType, t.colCoords, t.colAlt, t.colThreats, ""]} />
            {sheet.targets.map((tg, i) => (
              <div key={i} className="grid items-center gap-1.5" style={{ gridTemplateColumns: TARGET_COLS }}>
                <span className="numeric text-sm font-semibold text-muted">{i + 1}</span>
                <Field label={`${t.colType} ${i + 1}`} value={tg.type} onChange={(v) => setListRow("targets", i, "type", v)} />
                <Field label={`${t.colCoords} ${i + 1}`} value={tg.coords} onChange={(v) => setListRow("targets", i, "coords", v)} mono />
                <Field label={`${t.colAlt} ${i + 1}`} value={tg.alt} onChange={(v) => setListRow("targets", i, "alt", v)} mono />
                <Field label={`${t.colThreats} ${i + 1}`} value={tg.notes} onChange={(v) => setListRow("targets", i, "notes", v)} />
                <RemoveRow
                  label={`${t.removeRow} ${i + 1}`}
                  onClick={() => update((s) => ({ ...s, targets: s.targets.filter((_, j) => j !== i) }))}
                />
              </div>
            ))}
          </Wide>
          {sheet.targets.length < TACTICAL_LIMITS.targets && (
            <AddRow
              label={t.addRow}
              onClick={() => update((s) => ({ ...s, targets: [...s.targets, { type: "", coords: "", alt: "", notes: "" }] }))}
            />
          )}
        </Section>

        <Section title={t.sectionSupport}>
          <Wide>
            <GridHead
              cols={SUPPORT_COLS}
              labels={["", t.colRole, t.colAcType, "Callsign", "UHF", "VHF", "TCN", t.colAlt, t.colNotes, ""]}
            />
            {sheet.support.map((u, i) => {
              const set = (key: keyof SupportUnit) => (v: string) => setSupport(i, { ...u, [key]: v });
              const label = `${t.sectionSupport} ${i + 1}`;
              return (
                <div key={i} className="grid items-center gap-1.5" style={{ gridTemplateColumns: SUPPORT_COLS }}>
                  <Select
                    label={`${t.chooseSupport} ${label}`}
                    size="sm"
                    value=""
                    placeholder={t.chooseSupport}
                    options={supportOptions}
                    disabled={!supportOptions.length}
                    onChange={(v) => {
                      const picked = refs?.support[Number(v)];
                      if (picked) setSupport(i, { ...picked });
                    }}
                  />
                  <Field label={`${t.colRole} ${i + 1}`} value={u.role} onChange={set("role")} mono />
                  <Field label={`${t.colAcType} ${i + 1}`} value={u.type} onChange={set("type")} />
                  <Field label={`Callsign ${i + 1}`} value={u.callsign} onChange={set("callsign")} />
                  <Field label={`UHF ${label}`} value={u.uhf} onChange={set("uhf")} mono />
                  <Field label={`VHF ${label}`} value={u.vhf} onChange={set("vhf")} mono />
                  <Field label={`TCN ${label}`} value={u.tacan} onChange={set("tacan")} mono />
                  <Field label={`${t.colAlt} ${label}`} value={u.alt} onChange={set("alt")} mono />
                  <Field label={`${t.colNotes} ${label}`} value={u.notes} onChange={set("notes")} />
                  <RemoveRow
                    label={`${t.removeRow} ${label}`}
                    onClick={() => update((s) => ({ ...s, support: s.support.filter((_, j) => j !== i) }))}
                  />
                </div>
              );
            })}
          </Wide>
          {sheet.support.length < TACTICAL_LIMITS.support && (
            <AddRow label={t.addRow} onClick={() => update((s) => ({ ...s, support: [...s.support, emptySupport()] }))} />
          )}
        </Section>

        <Section title={t.sectionFlightNotes}>
          <div className="space-y-2">
            <div className="text-xs text-subtle">{t.sectionRamrod}</div>
            <RamrodInputs chars={sheet.ramrod} onChange={(ramrod) => update((s) => ({ ...s, ramrod }))} />
          </div>
          <div className="space-y-2 pt-2">
            <div className="text-xs text-subtle">{t.sectionRtba}</div>
            <Rows
              columns={[
                { key: "wp", label: t.colWaypoint, grow: 3 },
                { key: "offset", label: "T+", grow: 2, mono: true },
              ]}
              rows={sheet.rtba}
              max={TACTICAL_LIMITS.rtba}
              empty={{ wp: "", offset: "" }}
              onChange={(rtba) => update((s) => ({ ...s, rtba }))}
            />
            <p className="text-xs text-subtle">{t.rtbaHint}</p>
          </div>
          <textarea
            className="input mt-2 min-h-24 text-sm"
            aria-label={t.sectionNotes}
            value={sheet.notes}
            maxLength={TACTICAL_LIMITS.notes}
            onChange={(e) => update((s) => ({ ...s, notes: e.target.value }))}
          />
        </Section>

        {initial && <p className="text-xs text-muted">{t.editWarning}</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex justify-end gap-2 border-t border-line bg-overlay px-5 py-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t.cancel}
          </button>
          <button type="submit" className="btn-primary" disabled={working}>
            {initial ? (working ? t.editSaving : t.editSubmit) : working ? t.creating : t.tacticalSubmit}
          </button>
        </div>
      </form>
      {refsOpen && refs && (
        <TacticalRefsDialog
          initial={refs}
          onClose={() => setRefsOpen(false)}
          onSaved={(saved) => {
            setRefs(saved);
            setRefsOpen(false);
          }}
        />
      )}
    </dialog>
  );
}

const AIRBASE_COLS = "3rem minmax(9rem,1.6fr) repeat(7,minmax(4.5rem,1fr))";
const FLIGHT_COLS = "1.5rem minmax(7rem,1.6fr) repeat(5,minmax(4rem,1fr)) minmax(8rem,2fr)";
const COM_COLS = "minmax(6rem,1.3fr) minmax(3.5rem,0.8fr) minmax(5rem,1fr) minmax(6rem,1.6fr) 2.25rem";
const SUPPORT_COLS =
  "minmax(6rem,1.2fr) minmax(3.5rem,0.6fr) minmax(6rem,1.2fr) minmax(6rem,1.1fr) repeat(4,minmax(4rem,0.8fr)) minmax(6rem,1.3fr) 2.25rem";
const TARGET_COLS = "1.5rem minmax(6rem,1.2fr) minmax(9rem,2fr) minmax(4.5rem,0.8fr) minmax(8rem,2fr) 2.25rem";

/** Casques : HMCS, NVG (plus une valeur saisie autrefois, s'il y en a une). */
function helmetOptions(current: string) {
  const values: string[] = [...HELMETS];
  if (current && !values.includes(current)) values.push(current);
  return [{ value: "", label: "—" }, ...values.map((v) => ({ value: v, label: v }))];
}

function RemoveRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn-icon size-9" aria-label={label} onClick={onClick}>
      <X size={16} strokeWidth={1.75} />
    </button>
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn-ghost -ml-2 min-h-9 px-2 text-sm" onClick={onClick}>
      <Plus size={15} strokeWidth={1.75} />
      {label}
    </button>
  );
}

/** Grille large : défile horizontalement sur petit écran. */
function Wide({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="min-w-[48rem] space-y-1.5">{children}</div>
    </div>
  );
}

function GridHead({ cols, labels }: { cols: string; labels: string[] }) {
  return (
    <div className="grid gap-1.5 text-xs text-subtle" style={{ gridTemplateColumns: cols }}>
      {labels.map((label, i) => (
        <span key={i} className="truncate">
          {label}
        </span>
      ))}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-subtle">
      {label}
      {children}
    </label>
  );
}
