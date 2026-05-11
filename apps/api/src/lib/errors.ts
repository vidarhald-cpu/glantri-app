import type { FastifyReply } from "fastify";

export class NotFoundError extends Error {
  constructor(message = "Not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export function handleRouteError(error: unknown, reply: FastifyReply) {
  if (error instanceof NotFoundError) {
    return reply.code(404).send({ error: error.message });
  }
  if (error instanceof Error) {
    return reply.code(400).send({ error: error.message });
  }
  throw error;
}
