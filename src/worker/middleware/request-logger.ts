import type { MiddlewareHandler } from "hono";
import type { Env } from "../types";

export const requestLogger: MiddlewareHandler<Env> = async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  console.log(
    JSON.stringify({
      event: "request",
      method,
      path,
      status,
      duration_ms: duration,
    }),
  );
};
