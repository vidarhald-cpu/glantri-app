import { importThemistogenesWeapons } from "../themistogenes/importWeapons";

export async function runImportWorkbook() {
  const result = importThemistogenesWeapons();
  console.log(
    JSON.stringify(
      {
        importedWeaponCount: result.report.importedWeaponCount,
        skippedRows: result.report.skippedRows,
        sourceSheets: result.report.sourceSheets,
        warningCount: result.report.warnings.length,
        warnings: result.report.warnings.slice(0, 20),
      },
      null,
      2,
    ),
  );
}

if (require.main === module) {
  runImportWorkbook().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
