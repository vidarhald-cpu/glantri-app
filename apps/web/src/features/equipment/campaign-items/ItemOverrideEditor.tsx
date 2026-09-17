"use client";

import {
  getItemOverrideChoices,
  itemOverrideKey,
  type EquipmentTemplate,
  type ItemMechanicalOverride,
} from "@glantri/domain/equipment";

export function ItemOverrideEditor({
  template,
  value,
  onChange,
}: {
  template: EquipmentTemplate;
  value: ItemMechanicalOverride[];
  onChange: (value: ItemMechanicalOverride[]) => void;
}) {
  const choices = getItemOverrideChoices(template);
  if (!choices.length) return null;
  return (
    <details>
      <summary>Equipment inputs · inherit or customize</summary>
      <p>
        These inputs affect existing Equipment calculations. Removing an override restores live
        Template inheritance.
      </p>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {choices.map((choice) => {
          const key = itemOverrideKey(choice.entry);
          const current = value.find((entry) => itemOverrideKey(entry) === key);
          const set = (entry?: ItemMechanicalOverride) =>
            onChange([
              ...value.filter((candidate) => itemOverrideKey(candidate) !== key),
              ...(entry ? [entry] : []),
            ]);
          return (
            <fieldset key={key} style={{ minWidth: 0, display: "grid", gap: "0.4rem" }}>
              <legend>{choice.label}</legend>
              <div>
                Template: {choice.templateValue} · Effective:{" "}
                {current?.value ?? choice.templateValue}
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={current !== undefined}
                  onChange={(event) => set(event.target.checked ? choice.entry : undefined)}
                />{" "}
                Override {choice.label}
              </label>
              {current ? (
                <>
                  <label>
                    Item override{" "}
                    <input
                      aria-label={`${choice.label} override`}
                      type="number"
                      step="any"
                      value={current.value}
                      onChange={(event) => set({ ...current, value: Number(event.target.value) })}
                    />
                  </label>
                  <label>
                    Player visibility{" "}
                    <select
                      value={current.visibility}
                      onChange={(event) =>
                        set({
                          ...current,
                          visibility: event.target.value as "gm_only" | "revealed",
                        })
                      }
                    >
                      <option value="gm_only">GM only</option>
                      <option value="revealed">Revealed to holder</option>
                    </select>
                  </label>
                  <button type="button" onClick={() => set()}>
                    Revert {choice.label} to Template
                  </button>
                </>
              ) : (
                <span>Item override: none · Inherited</span>
              )}
            </fieldset>
          );
        })}
      </div>
    </details>
  );
}
