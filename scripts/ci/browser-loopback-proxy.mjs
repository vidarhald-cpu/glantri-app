import net from "node:net";

const LISTEN_HOST = "127.0.0.1";
const TARGET_HOST = "dind.docker.internal";
const ROUTES = [
  { label: "Web", port: 3000 },
  { label: "API", port: 4000 },
];

if (process.env.CI !== "true") {
  throw new Error("The browser loopback proxy may run only with CI=true.");
}

const servers = new Set();
const sockets = new Set();

function startProxy({ label, port }) {
  const server = net.createServer((client) => {
    const upstream = net.connect({ host: TARGET_HOST, port });
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
    console.error(`${label} browser loopback proxy failed: ${error.message}`);
    shutdown(1);
  });
  server.listen(port, LISTEN_HOST, () => {
    console.log(
      `${label} browser loopback proxy listening on ${LISTEN_HOST}:${port} for isolated DIND.`,
    );
  });
  servers.add(server);
}

for (const route of ROUTES) {
  startProxy(route);
}

function shutdown(exitCode = 0) {
  for (const socket of sockets) {
    socket.destroy();
  }
  const listeningServers = [...servers].filter((server) => server.listening);
  let remaining = listeningServers.length;
  if (remaining === 0) process.exit(exitCode);
  for (const server of listeningServers) {
    server.close(() => {
      remaining -= 1;
      if (remaining === 0) process.exit(exitCode);
    });
  }
}

process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());
