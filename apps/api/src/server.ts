import { buildApiServer } from "./app";
import { describeListenFailure, resolveApiBinding } from "./lib/serverBinding";

async function start() {
  const app = buildApiServer();
  const binding = resolveApiBinding(process.env);

  try {
    await app.listen(binding);
  } catch (error) {
    throw new Error(describeListenFailure(binding, error), { cause: error });
  }
}

start().catch((error) => {
  process.stderr.write(
    JSON.stringify({ level: "fatal", msg: "Failed to start server", err: String(error) }) + "\n",
  );
  process.exit(1);
});
