import type { Result } from "@onrails/result";

export function bad(): Promise<Result<number, Error>> {
  return Promise.resolve({ _tag: "Ok", value: 1 } as Result<number, Error>);
}

export interface BadShape {
  run(): Promise<Result<string, { kind: "fail" }>>;
}
