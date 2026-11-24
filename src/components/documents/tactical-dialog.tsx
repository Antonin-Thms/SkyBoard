"use client";

import { Copy, ListPlus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getTacticalRefs, setActiveRefSet } from "@/app/(app)/documents/actions";
import { Select, type SelectOption } from "@/components/ui/select";
import { renderTactical } from "@/lib/documents/render-tactical";
import {
  airfieldFromRef,
  cleanTacticalSheet,
  emptyPackageMember,
  emptyStation,
  emptySupportRow,
  emptyTacticalSheet,
  emptyWaypoint,
  HELMETS,
  supportFromRef,
  TACTICAL_LIMITS,
  withWingmenTacan,
  type Airfield,
  type Loadout,
  type TacticalRefs,
  type TacticalSheet,
} from "@/lib/documents/tactical";
import { useT } from "@/lib/i18n/client";
import { uuid } from "@/lib/uuid";
import type { CreatedPage } from "./create-pages";
import { TacticalRefsDialog, type RefSetsState } from "./tactical-refs-dialog";
import { Field, RamrodInputs, Rows, Section } from "./tactical-fields";

type Role = keyof TacticalSheet["airfields"];
/** Listes de lignes modifiables de la fiche. */
type ListKey = "flight" | "loadout" | "uhf" | "vhf" | "waypoints" | "package" | "support";
type Column<K extends string> = { key: K; label: string; w: string; mono?: boolean };

/**
 * Fiche tactique (« mission card ») au format de la fiche Excel de
 * l'escadron : DATA, AIRFIELDS, FLIGHT, LOADOUT, RADIO, WAYPOINTS, PACKAGE,
 * SUPPORT, ADMIN, RTBA, GAMEPLAN. Terrains, stations radio et support se
 * choisissent dans les listes du pilote (« Gérer mes listes »).
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
  const [refSets, setRefSets] = useState<RefSetsState | null>(null);
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
      .then((r) => alive && setRefSets(r))
      .catch(() => alive && setRefSets({ sets: [], activeId: null }));
    return () => {
      alive = false;
    };
  }, []);

  const update = (fn: (s: TacticalSheet) => TacticalSheet) => setSheet((prev) => fn(prev));
  /** Champ d'un groupe (data, loadout, fuel, spec, bullseye). */
  const setIn =
    <G extends "data" | "fuel" | "spec" | "bullseye">(group: G, key: keyof TacticalSheet[G]) =>
    (value: string) =>
      update((s) => ({ ...s, [group]: { ...s[group], [key]: value } }));
  const setText = (key: "comNotes" | "spin" | "wptNotes" | "threatNotes" | "gameplan") => (value: string) =>
    update((s) => ({ ...s, [key]: value }));
  const setAirfield = (role: Role, value: Airfield) => update((s) => ({ ...s, airfields: { ...s.airfields, [role]: value } }));
  const setList = <L extends ListKey>(list: L, rows: TacticalSheet[L]) => update((s) => ({ ...s, [list]: rows }));

  async function create() {
    const name = title.trim().slice(0, 120) || sheet.data.task.trim() || sheet.data.callsign.trim() || t.tacticalDefaultTitle;
    const clean = cleanTacticalSheet(sheet);
    setWorking(true);
    setError(null);
    try {
      const files = await renderTactical(name, clean);
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

  /** Liste active (choix rapide d'une liste à l'autre). */
  const refs: TacticalRefs | null = refSets
    ? (refSets.sets.find((x) => x.id === refSets.activeId) ?? { airbases: [], stations: [], support: [] })
    : null;
  function switchSet(id: string) {
    setRefSets((r) => (r ? { ...r, activeId: id } : r));
    // Mémorisée pour la prochaine fiche (sans bloquer si l'enregistrement échoue).
    if (id !== "legacy") void setActiveRefSet(id).catch(() => undefined);
  }

  const options = (labels: string[]): SelectOption[] => labels.map((label, i) => ({ value: String(i), label }));
  const airbaseOptions = options((refs?.airbases ?? []).map((a) => [a.name, a.tacan].filter(Boolean).join(" · ")));
  const stationOptions = options((refs?.stations ?? []).map((s) => [s.code, s.name, s.freq].filter(Boolean).join(" · ")));
  const supportOptions = options((refs?.support ?? []).map((u) => [u.callsign, u.type, u.notes].filter(Boolean).join(" · ")));
  const wingmen = withWingmenTacan(sheet.flight);
  const noRefs = refs !== null && !refs.airbases.length && !refs.stations.length;
  const d = sheet.data;
  const fu = sheet.fuel;
  const sp = sheet.spec;
  const be = sheet.bullseye;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="tactical-title"
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(68rem,calc(100vw-2rem))] rounded-[4px] bg-overlay p-0 text-fg shadow-popover backdrop:bg-black/60"
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
            {refSets && refSets.sets.length > 0 && (
              <Select
                size="sm"
                value={refSets.activeId ?? ""}
                options={refSets.sets.map((x) => ({ value: x.id, label: x.name }))}
                label={t.refsActive}
                align="end"
                className="max-w-[16rem]"
                onChange={switchSet}
              />
            )}
            <button type="button" className="btn-secondary min-h-9 px-3 text-sm" disabled={refs === null} onClick={() => setRefsOpen(true)}>
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

        <Section title="Data">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-7">
            {(
              [
                ["callsign", "Callsign"],
                ["task", "Task"],
                ["date", "Date"],
                ["time", "Time"],
                ["area", "Area"],
                ["server", "Server"],
                ["package", "Package"],
              ] as const
            ).map(([key, label]) => (
              <Labeled key={key} label={label}>
                <Field label={label} value={d[key]} onChange={setIn("data", key)} />
              </Labeled>
            ))}
          </div>
          <Labeled label="Weather">
            <Field label="Weather" value={d.weather} onChange={setIn("data", "weather")} mono />
          </Labeled>
        </Section>

        <Section title="Airfields">
          <Wide>
            <GridHead cols={AIRFIELD_COLS} labels={["", t.chooseAirbase, "Name", "RWY", "TCN", "WPT", "FREQ", "ELEV", "Procedure", "ILS"]} />
            {(["dep", "arr", "alt"] as const).map((role) => {
              const a = sheet.airfields[role];
              const label = role.toUpperCase();
              const set = (key: keyof Airfield) => (v: string) => setAirfield(role, { ...a, [key]: v });
              return (
                <div key={role} className="grid items-center gap-1.5" style={{ gridTemplateColumns: AIRFIELD_COLS }}>
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
                      if (picked) setAirfield(role, { ...airfieldFromRef(picked), wpt: a.wpt, procedure: a.procedure });
                    }}
                  />
                  {(["name", "runway", "tacan", "wpt", "freq", "elev", "procedure", "ils"] as const).map((key) => (
                    <Field key={key} label={`${key} ${label}`} value={a[key]} onChange={set(key)} mono={key !== "name" && key !== "procedure"} />
                  ))}
                </div>
              );
            })}
          </Wide>
        </Section>

        <Section title="Flight">
          <Wide>
            <GridHead cols={FLIGHT_COLS} labels={["#", "Crew", "Type", "Helmet", "TCN", "SQWK", "SNCTRY", "LSR", "Serial", "Livery"]} />
            {sheet.flight.map((m, i) => {
              const set = (key: keyof typeof m) => (v: string) =>
                setList("flight", sheet.flight.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
              return (
                <div key={i} className="grid items-center gap-1.5" style={{ gridTemplateColumns: FLIGHT_COLS }}>
                  <span className="numeric text-sm font-semibold text-muted">{i + 1}</span>
                  <Field label={`Crew ${i + 1}`} value={m.crew} onChange={set("crew")} />
                  <Field label={`Type ${i + 1}`} value={m.type} onChange={set("type")} mono />
                  <Select
                    label={`Helmet ${i + 1}`}
                    size="sm"
                    value={m.helmet}
                    placeholder="—"
                    options={helmetOptions(m.helmet)}
                    onChange={set("helmet")}
                  />
                  {i === 0 ? (
                    <Field label="TCN 1" value={m.tacan} onChange={set("tacan")} mono />
                  ) : (
                    // Ailiers : TACAN du leader + 63, calculé.
                    <Field label={`TCN ${i + 1}`} value={wingmen[i].tacan} onChange={() => {}} mono readOnly />
                  )}
                  {(["sqwk", "sanctuary", "laser", "serial", "livery"] as const).map((key) => (
                    <Field key={key} label={`${key} ${i + 1}`} value={m[key]} onChange={set(key)} mono />
                  ))}
                </div>
              );
            })}
          </Wide>
          <p className="text-xs text-subtle">{t.tacanHint}</p>
        </Section>

        <Section title="Loadout">
          {/* Configuration : une ligne par avion de la patrouille */}
          <Group title="Configuration">
            <Wide>
              <GridHead cols={LOADOUT_COLS} labels={["#", "Crew", "A/A", "Tanks", "ECM POD", "A/G", "PODS", "CH/FL", "Notes"]} />
              {sheet.loadout.map((l, i) => {
                const set = (key: keyof Loadout) => (v: string) =>
                  setList("loadout", sheet.loadout.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
                return (
                  <div key={i} className="grid items-center gap-1.5" style={{ gridTemplateColumns: LOADOUT_COLS }}>
                    <span className="numeric text-sm font-semibold text-muted">{i + 1}</span>
                    <span className="truncate text-sm text-muted">{sheet.flight[i]?.crew || "—"}</span>
                    {(["aa", "tanks", "ecm", "ag", "pods", "chfl", "notes"] as const).map((key) => (
                      <Field key={key} label={`${key} ${i + 1}`} value={l[key]} onChange={set(key)} mono={key === "tanks" || key === "ecm"} />
                    ))}
                  </div>
                );
              })}
            </Wide>
            <button
              type="button"
              className="btn-ghost -ml-2 min-h-9 px-2 text-sm"
              onClick={() => setList("loadout", sheet.loadout.map(() => ({ ...sheet.loadout[0] })))}
            >
              <Copy size={15} strokeWidth={1.75} />
              {t.loadoutCopy}
            </button>
          </Group>
          <div className="grid gap-4 sm:grid-cols-2">
            <Group title="Fuel">
              <Pair label="Total" value={fu.total} onChange={setIn("fuel", "total")} />
              <Pair label="Target" value={fu.target} onChange={setIn("fuel", "target")} />
              <Pair label="Joker" value={fu.joker} onChange={setIn("fuel", "joker")} />
              <Pair label="Bingo" value={fu.bingo} onChange={setIn("fuel", "bingo")} />
              <Pair label="ALTN fuel" value={fu.altn} onChange={setIn("fuel", "altn")} />
            </Group>
            <Group title="Spec">
              <Pair label="ROT SPD" value={sp.rotSpd} onChange={setIn("spec", "rotSpd")} />
              <Pair label="ALOW" value={sp.alow} onChange={setIn("spec", "alow")} />
              <Pair label="MSL" value={sp.msl} onChange={setIn("spec", "msl")} />
              <Pair label="STN" value={sp.stn} onChange={setIn("spec", "stn")} />
            </Group>
          </div>
        </Section>

        <Section title="Radio">
          <div className="grid gap-4 lg:grid-cols-2">
            {(["uhf", "vhf"] as const).map((band) => (
              <Group key={band} title={band.toUpperCase()}>
                <Table
                  columns={STATION_COLS}
                  rows={sheet[band]}
                  max={TACTICAL_LIMITS.com}
                  empty={emptyStation}
                  onChange={(rows) => setList(band, rows)}
                  pick={{ label: t.chooseStation, options: stationOptions, from: (i) => refs?.stations[i] }}
                  name={band.toUpperCase()}
                  addLabel={t.addRow}
                  removeLabel={t.removeRow}
                />
              </Group>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <TextArea label="COM notes" value={sheet.comNotes} onChange={setText("comNotes")} />
            <TextArea label="Spin" value={sheet.spin} onChange={setText("spin")} />
          </div>
        </Section>

        <Section title="Waypoints">
          <Table
            columns={WAYPOINT_COLS}
            rows={sheet.waypoints}
            max={TACTICAL_LIMITS.waypoints}
            empty={emptyWaypoint}
            onChange={(rows) => setList("waypoints", rows)}
            name="WPT"
            addLabel={t.addRow}
            removeLabel={t.removeRow}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextArea label="WPT notes" value={sheet.wptNotes} onChange={setText("wptNotes")} />
            <TextArea label="Threat notes" value={sheet.threatNotes} onChange={setText("threatNotes")} />
          </div>
        </Section>

        <Section title="Package">
          <Wide>
            <Table
              columns={PACKAGE_COLS}
              rows={sheet.package}
              max={TACTICAL_LIMITS.package}
              empty={emptyPackageMember}
              onChange={(rows) => setList("package", rows)}
              name="Package"
              addLabel={t.addRow}
              removeLabel={t.removeRow}
            />
          </Wide>
        </Section>

        <Section title="Support">
          <Wide>
            <Table
              columns={SUPPORT_COLS}
              rows={sheet.support}
              max={TACTICAL_LIMITS.support}
              empty={emptySupportRow}
              onChange={(rows) => setList("support", rows)}
              pick={{
                label: t.chooseSupport,
                options: supportOptions,
                from: (i) => (refs?.support[i] ? supportFromRef(refs.support[i]) : undefined),
              }}
              name="Support"
              addLabel={t.addRow}
              removeLabel={t.removeRow}
            />
          </Wide>
        </Section>

        <Section title="Admin">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {(
              [
                ["name", "Bullseye"],
                ["lat", "Lat"],
                ["lon", "Long"],
                ["wpt", "WPT"],
              ] as const
            ).map(([key, label]) => (
              <Labeled key={key} label={label}>
                <Field label={label} value={be[key]} onChange={setIn("bullseye", key)} mono={key !== "name"} />
              </Labeled>
            ))}
          </div>
          <div className="space-y-2 pt-2">
            <div className="text-xs text-subtle">{t.sectionRamrod}</div>
            <RamrodInputs chars={sheet.ramrod} onChange={(ramrod) => update((s) => ({ ...s, ramrod }))} />
          </div>
        </Section>

        <Section title="RTBA">
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
        </Section>

        <Section title="Gameplan">
          <textarea
            className="input min-h-32 text-sm"
            aria-label="Gameplan"
            value={sheet.gameplan}
            maxLength={TACTICAL_LIMITS.notes}
            onChange={(e) => setText("gameplan")(e.target.value)}
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
      {refsOpen && refSets && (
        <TacticalRefsDialog
          initial={refSets}
          onClose={() => setRefsOpen(false)}
          onChange={(state, close) => {
            setRefSets(state);
            if (close) setRefsOpen(false);
          }}
        />
      )}
    </dialog>
  );
}

const AIRFIELD_COLS = "2.5rem minmax(8rem,1.4fr) minmax(5rem,1fr) repeat(5,minmax(4rem,0.8fr)) minmax(6rem,1.3fr) minmax(5rem,1fr)";
const FLIGHT_COLS = "1.5rem minmax(6rem,1.4fr) minmax(3.5rem,0.7fr) minmax(5rem,0.9fr) repeat(5,minmax(3.5rem,0.8fr)) minmax(5rem,1fr)";
const LOADOUT_COLS =
  "1.5rem minmax(5rem,0.9fr) minmax(4.5rem,0.9fr) minmax(3rem,0.5fr) minmax(3.5rem,0.6fr) minmax(8rem,1.8fr) minmax(5rem,1fr) minmax(5rem,1fr) minmax(5rem,1fr)";
const STATION_COLS: Column<"code" | "freq" | "name">[] = [
  { key: "code", label: "CH", w: "minmax(3rem,0.6fr)", mono: true },
  { key: "freq", label: "Freq", w: "minmax(4.5rem,0.9fr)", mono: true },
  { key: "name", label: "Name", w: "minmax(6rem,1.5fr)" },
];
const WAYPOINT_COLS: Column<"n" | "name" | "coords" | "alt">[] = [
  { key: "n", label: "N°", w: "minmax(2.5rem,0.4fr)", mono: true },
  { key: "name", label: "Name", w: "minmax(7rem,1.4fr)" },
  { key: "coords", label: "Coordinates", w: "minmax(10rem,2fr)", mono: true },
  { key: "alt", label: "Altitude", w: "minmax(4rem,0.7fr)", mono: true },
];
const PACKAGE_COLS: Column<"callsign" | "type" | "com" | "leader" | "stn" | "tacan" | "alt" | "task">[] = [
  { key: "callsign", label: "Callsign", w: "minmax(6rem,1.3fr)" },
  { key: "type", label: "Type", w: "minmax(4rem,0.9fr)" },
  { key: "com", label: "COM", w: "minmax(4rem,0.8fr)", mono: true },
  { key: "leader", label: "Leader", w: "minmax(5rem,1fr)" },
  { key: "stn", label: "STN", w: "minmax(3.5rem,0.7fr)", mono: true },
  { key: "tacan", label: "TCN", w: "minmax(3.5rem,0.7fr)", mono: true },
  { key: "alt", label: "ALT", w: "minmax(3.5rem,0.7fr)", mono: true },
  { key: "task", label: "Task", w: "minmax(5rem,1.1fr)" },
];
const SUPPORT_COLS: Column<"role" | "type" | "callsign" | "com" | "wpt" | "tacan" | "alt" | "notes">[] = [
  { key: "role", label: "Role", w: "minmax(3.5rem,0.7fr)", mono: true },
  { key: "type", label: "Type", w: "minmax(5rem,1fr)" },
  { key: "callsign", label: "Callsign", w: "minmax(5rem,1fr)" },
  { key: "com", label: "COM", w: "minmax(5rem,1fr)", mono: true },
  { key: "wpt", label: "WPT", w: "minmax(3rem,0.6fr)", mono: true },
  { key: "tacan", label: "TCN", w: "minmax(3.5rem,0.7fr)", mono: true },
  { key: "alt", label: "ALT", w: "minmax(3.5rem,0.7fr)", mono: true },
  { key: "notes", label: "Notes", w: "minmax(5rem,1.2fr)" },
];

/** Casques : HMCS, NVG (plus une valeur saisie autrefois, s'il y en a une). */
function helmetOptions(current: string) {
  const values: string[] = [...HELMETS];
  if (current && !values.includes(current)) values.push(current);
  return [{ value: "", label: "—" }, ...values.map((v) => ({ value: v, label: v }))];
}

/**
 * Tableau de lignes modifiables : choix facultatif dans une liste en tête
 * de ligne, retrait par ligne, ajout jusqu'à `max`.
 */
function Table<K extends string, R extends Record<K, string>>({
  columns,
  rows,
  max,
  empty,
  onChange,
  pick,
  name,
  addLabel,
  removeLabel,
}: {
  columns: Column<K>[];
  rows: R[];
  max: number;
  empty: () => R;
  onChange: (rows: R[]) => void;
  pick?: { label: string; options: SelectOption[]; from: (index: number) => Partial<R> | undefined };
  name: string;
  addLabel: string;
  removeLabel: string;
}) {
  const cols = [pick ? "minmax(6rem,1.2fr)" : "", ...columns.map((c) => c.w), "2.25rem"].filter(Boolean).join(" ");
  return (
    <div className="space-y-1.5">
      <GridHead cols={cols} labels={[...(pick ? [""] : []), ...columns.map((c) => c.label), ""]} />
      {rows.map((r, i) => (
        <div key={i} className="grid items-center gap-1.5" style={{ gridTemplateColumns: cols }}>
          {pick && (
            <Select
              label={`${pick.label} ${name} ${i + 1}`}
              size="sm"
              value=""
              placeholder={pick.label}
              options={pick.options}
              disabled={!pick.options.length}
              onChange={(v) => {
                const picked = pick.from(Number(v));
                if (picked) onChange(rows.map((x, j) => (j === i ? { ...x, ...picked } : x)));
              }}
            />
          )}
          {columns.map((c) => (
            <Field
              key={c.key}
              label={`${c.label} ${name} ${i + 1}`}
              value={r[c.key]}
              mono={c.mono}
              onChange={(v) => onChange(rows.map((x, j) => (j === i ? { ...x, [c.key]: v } : x)))}
            />
          ))}
          <button
            type="button"
            className="btn-icon size-9"
            aria-label={`${removeLabel} ${name} ${i + 1}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
      ))}
      {rows.length < max && (
        <button type="button" className="btn-ghost -ml-2 min-h-9 px-2 text-sm" onClick={() => onChange([...rows, empty()])}>
          <Plus size={15} strokeWidth={1.75} />
          {addLabel}
        </button>
      )}
    </div>
  );
}

/** Grille large : défile horizontalement sur petit écran. */
function Wide({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="min-w-[52rem] space-y-1.5">{children}</div>
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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="numeric text-sm font-semibold text-muted">{title}</div>
      {children}
    </div>
  );
}

/** Libellé à gauche, champ à droite (emports, carburant, spec). */
function Pair({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-1.5 text-xs font-semibold text-muted">
      {label}
      <Field label={label} value={value} onChange={onChange} />
    </label>
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

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-subtle">
      {label}
      <textarea
        className="input min-h-24 text-sm"
        value={value}
        maxLength={TACTICAL_LIMITS.text}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
