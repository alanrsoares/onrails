import type { ResultAsync } from "@onrails/result";

export function good(): ResultAsync<number, Error> {
  return null as unknown as ResultAsync<number, Error>;
}

export interface GoodShape {
  run(): ResultAsync<string, { kind: "fail" }>;
}
