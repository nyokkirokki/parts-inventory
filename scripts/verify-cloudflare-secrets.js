#!/usr/bin/env node
import { env } from "node:process";

const requiredKeys = ["BASIC_AUTH_USER", "BASIC_AUTH_PASSWORD"];
const missing = requiredKeys.filter((key) => !env[key]?.trim());

if (missing.length > 0) {
  console.error("Missing required Cloudflare secret environment values:", missing.join(", "));
  process.exit(1);
}

console.log("Cloudflare environment verification passed: required secret variables are present.");
