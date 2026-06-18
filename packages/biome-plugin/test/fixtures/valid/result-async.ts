import type { ResultAsync } from "@onrails/result";

export const good = (): ResultAsync<number, Error> => null as unknown as ResultAsync<number, Error>;

export interface GoodShape {
  run(): ResultAsync<string, { kind: "fail" }>;
}
