import type { ResultAsync } from "./async.js";
import { fromAsync } from "./interop.js";
import { err, isOk, ok } from "./result.js";
import type { Result } from "./types.js";

/** openapi-fetch style response before unwrapping */
export type FetchResult<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

/** Error with a `message` field for MCP tool boundaries */
export type ErrorWithMessage = { message: string };

/** MCP tool success / error shape (structured content + text) */
export type ToolResponse<T> =
  | { structuredContent: T; content: { type: "text"; text: string }[] }
  | { content: { type: "text"; text: string }[]; isError: true };

/**
 * Map an openapi-fetch (or similar) response to a {@link Result}.
 * Supply `toError` to build your domain error (e.g. `PrintrApiError`).
 */
export const unwrapFetchResult = <T, E>(
  result: FetchResult<T>,
  toError: (detail: { error: unknown; response: Response }) => E,
): Result<T, E> => {
  if (result.error !== undefined || result.data === undefined) {
    return err(toError({ error: result.error, response: result.response }));
  }
  return ok(result.data);
};

/** Default detail extractor — sanitises HTML / empty bodies */
export const extractFetchErrorDetail = (error: unknown, response: Response): string => {
  if (error === undefined || error === null) {
    return response.statusText || "unknown error";
  }
  const raw = typeof error === "object" ? JSON.stringify(error) : String(error);
  const lower = raw.toLowerCase();
  if (lower.includes("<!doctype") || lower.includes("<html")) {
    const statusHint =
      response.status === 403
        ? "request blocked by CDN/WAF"
        : `unexpected HTML response (${response.status})`;
    return `${statusHint} — retry after a short delay`;
  }
  return raw;
};

/** Lift `client.GET(...)` promise to {@link ResultAsync} */
export const unwrapFetchResultAsync = <T, E>(
  promise: Promise<FetchResult<T>>,
  toError: (detail: { error: unknown; response: Response }) => E,
  onDefect?: (error: unknown) => E,
): ResultAsync<T, E> =>
  fromAsync(() => promise.then((r) => unwrapFetchResult(r, toError)), onDefect)() as ResultAsync<
    T,
    E
  >;

/** Format a sync {@link Result} as an MCP tool response */
export const toToolResponse = <T, E extends ErrorWithMessage>(
  result: Result<T, E>,
): ToolResponse<T> => {
  if (isOk(result)) {
    return {
      structuredContent: result.value,
      content: [{ type: "text" as const, text: JSON.stringify(result.value, null, 2) }],
    };
  }
  return {
    content: [{ type: "text" as const, text: result.error.message }],
    isError: true as const,
  };
};

/** Terminate a {@link ResultAsync} pipeline at an MCP tool handler */
export const toToolResponseAsync = async <T, E extends ErrorWithMessage>(
  resultAsync: ResultAsync<T, E>,
): Promise<ToolResponse<T>> => toToolResponse(await resultAsync.resolve());

export const toolOk = (data: Record<string, unknown>) => ({
  structuredContent: data,
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});

export const toolError = (text: string) => ({
  content: [{ type: "text" as const, text }],
  isError: true as const,
});
