import type { Result } from "@onrails/result";

export const bad = (): Promise<Result<number, Error>> => Promise.resolve({ _tag: "Ok", value: 1 } as Result<number, Error>);

export interface BadShape {
  run(): Promise<Result<string, { kind: "fail" }>>;
}
