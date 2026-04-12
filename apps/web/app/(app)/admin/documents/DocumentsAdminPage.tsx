"use client";

import { AdminPageIntro, AdminPanel } from "../admin-ui";

const obText =
  "Your melee OB starts with half your weapon skill, rounded normally, plus 1. Add the better of your Dexterity modifier or your Strength modifier, with Strength capped at +4 for this step. Then apply the weapon's OB together with any armor activity effect through the workbook adjustment table.";

const dmbText =
  "Your melee DMB starts with your Strength modifier plus the weapon's DMB. After that, the workbook rebalances the result against a standard +3 weapon bonus, so a weapon's OB and DMB work together instead of acting as two separate flat bonuses.";

const initiativeText =
  "Melee initiative is your Dexterity modifier plus the weapon's initiative plus the skill modifier from the workbook skill table. On the equipment screens, that is the full rule currently shown, because no extra game-sheet situation modifier is being added there yet.";

const encumbranceAndMovementText =
  "Your carrying capacity comes from Strength, Size, and half Constitution. Your carried load is compared to that capacity to find an encumbrance level, and that level then sets the movement modifier used for final movement on the equipment screens.";

export default function DocumentsAdminPage() {
  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Documents"
        title="Documents"
        summary="Short rules notes for current Glantri combat calculations."
      />

      <div style={{ display: "grid", gap: "1rem" }}>
        <AdminPanel title="OB">
          <p style={{ color: "#4f4635", lineHeight: 1.7, margin: 0 }}>{obText}</p>
        </AdminPanel>

        <AdminPanel title="DMB">
          <p style={{ color: "#4f4635", lineHeight: 1.7, margin: 0 }}>{dmbText}</p>
        </AdminPanel>

        <AdminPanel title="Initiative">
          <p style={{ color: "#4f4635", lineHeight: 1.7, margin: 0 }}>{initiativeText}</p>
        </AdminPanel>

        <AdminPanel title="Encumbrance and movement">
          <p style={{ color: "#4f4635", lineHeight: 1.7, margin: 0 }}>{encumbranceAndMovementText}</p>
        </AdminPanel>
      </div>
    </section>
  );
}
