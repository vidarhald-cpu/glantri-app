import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { generatedRepoLocalGlantriSeed } from "../src/seeds/generatedRepoLocalGlantriSeed";
import { armorTemplates } from "../src/equipment/armorTemplates";
import { importedWeaponTemplates } from "../src/equipment/importedWeaponTemplates";
import { shieldTemplates } from "../src/equipment/shieldTemplates";
import { gearTemplates } from "../src/equipment/gearTemplates";
import { valuableTemplates } from "../src/equipment/valuableTemplates";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../src/data");
mkdirSync(dataDir, { recursive: true });

function write(filename: string, data: unknown): void {
  const filePath = join(dataDir, filename);
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  console.log(`Written ${filePath}`);
}

write("canonicalContent.json", generatedRepoLocalGlantriSeed);
write("armorTemplates.json", armorTemplates);
write("weaponTemplates.json", importedWeaponTemplates);
write("shieldTemplates.json", shieldTemplates);
write("gearTemplates.json", gearTemplates);
write("valuableTemplates.json", valuableTemplates);
