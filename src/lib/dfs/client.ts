import "server-only";

import { connection } from "next/server";
import { executeAccount, executeLookup } from "./service";

async function credentials() {
  await connection();
  return {
    login: process.env.DATAFORSEO_LOGIN ?? null,
    password: process.env.DATAFORSEO_PASSWORD ?? null,
  };
}

export async function getAccount() {
  return executeAccount(await credentials());
}

export async function runLookup(raw: unknown) {
  return executeLookup(raw, await credentials());
}
