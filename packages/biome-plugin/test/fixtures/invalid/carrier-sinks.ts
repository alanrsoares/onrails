import type { Maybe, Result } from "@onrails/result";

declare const raw: string;
declare const res: { json(): Promise<unknown> };

export const a = JSON.parse(raw) as Result<number, string>;
export const b = structuredClone(a) as Maybe<number>;
export const c = (await res.json()) as Result<number, string>;
