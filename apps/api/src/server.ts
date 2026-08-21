import {
  assertDatabaseMigrationCompatibility,
  formatMigrationCompatibilityDiagnostic,
  migrationCompatibilityPrisma,
} from "@glantri/database";

import { buildApiServer } from "./app";

interface ApiServerStartupOptions {
  assertCompatibility?: typeof assertDatabaseMigrationCompatibility;
  buildServer?: typeof buildApiServer;
  database?: typeof migrationCompatibilityPrisma;
  writeDiagnostic?: (diagnostic: string) => void;
}

export async function startApiServer(options: ApiServerStartupOptions = {}) {
  const database = options.database ?? migrationCompatibilityPrisma;
  const compatibility = await (options.assertCompatibility ?? assertDatabaseMigrationCompatibility)(
    database,
  );
  (options.writeDiagnostic ?? console.log)(formatMigrationCompatibilityDiagnostic(compatibility));

  const app = (options.buildServer ?? buildApiServer)();
  const host = process.env.API_HOST ?? "0.0.0.0";
  const port = Number(process.env.API_PORT ?? "4000");

  await app.listen({ host, port });
}

if (require.main === module) {
  startApiServer().catch((error) => {
    process.stderr.write(
      JSON.stringify({ level: "fatal", msg: "Failed to start server", err: String(error) }) + "\n",
    );
    process.exit(1);
  });
}
