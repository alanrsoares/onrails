import { Result } from "@onrails/result";

declare const raw: string;
declare const load: () => unknown;
declare const lift: <T>(data: unknown) => T;

export const a = lift<Result<number, string>>(JSON.parse(raw));
export const b = load() as Result<number, string>;
export const c = JSON.parse(raw) as { readonly _tag: string };
export const e = Result.from<number, string>(JSON.parse(raw)) as Result<number, string>;
