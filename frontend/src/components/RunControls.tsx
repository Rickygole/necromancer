import { DEMO_SEED } from "../content";
import type { Mutation, Profile } from "../types";
import type { Controls } from "./Circle";

interface Props {
  controls: Controls;
  onControls: (next: Controls) => void;
  mutations: Mutation[];
  injected: string | null;
  replayOnly: boolean;
  liveHosted: boolean;
  busy: boolean;
  runLabel: string;
  onRun: () => void;
}

const RECORDED_MUTATIONS = new Set(["", "M4"]);

export function RunControls({ controls, onControls, mutations, injected, replayOnly, liveHosted, busy, runLabel, onRun }: Props) {
  const set = (patch: Partial<Controls>) => onControls({ ...controls, ...patch });
  const summary = replayOnly
    ? `recorded, ${controls.mutation === "M4" ? "M4 injected run" : "baseline"}`
    : `${controls.profile}, seed ${controls.seed || DEMO_SEED}, mutation ${controls.mutation || (controls.useDemoConfig ? injected : null) || "none"}`;

  return (
    <details className="drawer">
      <summary>
        <span className="drawer__title">Run settings</span>
        <span className="drawer__hint mono">{summary}</span>
      </summary>
      <form
        id="run-controls"
        className="drawer__body controls"
        aria-label="Run settings"
        onSubmit={(e) => {
          e.preventDefault();
          onRun();
        }}
      >
        {replayOnly ? (
          <p className="notice notice--warn" id="replay-note">
            Mutations run on the live oracle. This build replays the recorded M4 story. None replays the recorded
            baseline and M4 replays the recorded injected run. Profile, seed and the demo config apply to live runs only.
          </p>
        ) : null}
        <div className="row">
          <div className="field">
            <label htmlFor="profile">Profile</label>
            <select
              id="profile"
              className="input"
              disabled={replayOnly}
              aria-describedby={replayOnly ? "replay-note" : undefined}
              value={controls.profile}
              onChange={(e) => set({ profile: e.target.value as Profile })}
            >
              <option value="dev">dev, quick</option>
              <option value="demo">demo, stage sized</option>
              <option value="full">{liveHosted ? "full (recorded replay on the hosted build)" : "full, thorough"}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="seed">Seed</label>
            <input
              id="seed"
              className="input mono"
              disabled={replayOnly}
              aria-describedby={replayOnly ? "replay-note" : undefined}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="731942, the recorded seed"
              value={controls.seed}
              onChange={(e) => set({ seed: e.target.value.replace(/[^0-9]/g, "") })}
            />
          </div>
        </div>
        <fieldset className="mutations" aria-describedby={replayOnly ? "replay-note" : undefined}>
          <legend>Mutation</legend>
          <div className="mutations__grid">
            <label className="mutation">
              <input
                type="radio"
                name="mutation"
                value=""
                checked={controls.mutation === ""}
                onChange={() => set({ mutation: "" })}
              />
              <span className="mutation__id">None</span>
              <span className="mutation__label">Twin with the three preserved legacy behaviors</span>
            </label>
            {mutations.map((m) => {
              const active = controls.mutation === m.id || (controls.useDemoConfig && injected === m.id);
              const unavailable = replayOnly && !RECORDED_MUTATIONS.has(m.id);
              return (
                <label
                  key={m.id}
                  className={`mutation${active ? " is-active" : ""}${unavailable ? " is-unavailable" : ""}`}
                  title={unavailable ? `${m.description} Needs the live oracle.` : m.description}
                >
                  <input
                    type="radio"
                    name="mutation"
                    disabled={unavailable}
                    value={m.id}
                    checked={controls.mutation === m.id}
                    onChange={() => set({ mutation: m.id })}
                  />
                  <span className="mutation__id mono">{m.id}</span>
                  <span className="mutation__label">
                    {m.label}
                    {unavailable ? <span className="visually-hidden">, needs the live oracle</span> : null}
                  </span>
                  {active ? <span className="tag tag--danger">INJECTED</span> : null}
                </label>
              );
            })}
          </div>
          {mutations.length === 0 ? <p className="hint">Mutation list unavailable.</p> : null}
        </fieldset>
        <label className="check">
          <input
            type="checkbox"
            disabled={replayOnly || liveHosted}
            checked={controls.useDemoConfig}
            onChange={(e) => set({ useDemoConfig: e.target.checked })}
          />
          <span>
            Use demo config
            {controls.useDemoConfig && injected ? `, currently injects ${injected}` : ""}
            {liveHosted ? ", not available on the hosted build, pick a mutation above" : ""}
          </span>
        </label>
        <div className="button-row">
          <button type="submit" className="button" disabled={busy}>
            {runLabel}
          </button>
        </div>
      </form>
    </details>
  );
}
