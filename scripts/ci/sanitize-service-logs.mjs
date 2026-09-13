#!/usr/bin/env node

import process from "node:process";

import { sanitizeLogs } from "./current-run-services.mjs";

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  process.stdout.write(sanitizeLogs(input));
});
