import net from "node:net";

const LISTEN_HOST = "127.0.0.1";
const LISTEN_PORT = 5432;
const TARGET_HOST = "dind.docker.internal";
const TARGET_PORT = 5432;

if (process.env.CI !== "true") {
  throw new Error("The PostgreSQL loopback proxy may run only with CI=true.");
}

const sockets = new Set();

const server = net.createServer((client) => {
  const upstream = net.connect({ host: TARGET_HOST, port: TARGET_PORT });
  sockets.add(client);
  sockets.add(upstream);

  const closePair = () => {
    client.destroy();
    upstream.destroy();
  };
  client.once("error", closePair);
  upstream.once("error", closePair);
  client.once("close", () => sockets.delete(client));
  upstream.once("close", () => sockets.delete(upstream));
  client.pipe(upstream);
  upstream.pipe(client);
});

server.once("error", (error) => {
  console.error(`PostgreSQL loopback proxy failed: ${error.message}`);
  process.exitCode = 1;
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(
    `PostgreSQL loopback proxy listening on ${LISTEN_HOST}:${LISTEN_PORT} for isolated DIND.`,
  );
});

const shutdown = () => {
  for (const socket of sockets) {
    socket.destroy();
  }
  server.close(() => process.exit(0));
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
