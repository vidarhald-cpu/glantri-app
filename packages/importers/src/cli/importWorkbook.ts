import { loadCanonicalContent } from "@glantri/content";

export async function runImportWorkbook() {
  const content = await loadCanonicalContent();
  console.log("Workbook import placeholder", {
    professions: content.professions.length,
    skills: content.skills.length,
    skillGroups: content.skillGroups.length
  });
}

if (require.main === module) {
  runImportWorkbook().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
