import { buildApiServer } from "./app";

async function start() {
  const app = buildApiServer();
  const host = process.env.API_HOST ?? "0.0.0.0";
  const port = Number(process.env.API_PORT ?? "4000");

  await app.listen({ host, port });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
