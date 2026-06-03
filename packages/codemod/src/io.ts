import { ResultAsync } from "@onrails/result";

export const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

export const readFileText = (path: string): ResultAsync<string, Error> =>
  ResultAsync.fromPromise(Bun.file(path).text(), toError);

export const writeFileText = (path: string, content: string): ResultAsync<unknown, Error> =>
  ResultAsync.fromPromise(Bun.write(path, content), toError);
