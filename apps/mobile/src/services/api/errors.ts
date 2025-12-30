import { ApiError } from "./base";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extractMessage = (value: unknown, depth = 0): string | undefined => {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (isRecord(value) && depth < 3) {
    const keys = ["message", "error", "detail", "next_steps"] as const;
    for (const key of keys) {
      const field = value[key];
      const result = extractMessage(field, depth + 1);
      if (result) {
        return result;
      }
    }
  }

  return undefined;
};

export interface ParsedApiError<T = unknown> {
  status?: number;
  data?: T;
  detail?: unknown;
  message?: string;
  raw: unknown;
}

export const parseApiError = <T = unknown>(
  error: unknown,
): ParsedApiError<T> => {
  let status: number | undefined;
  let data: unknown;
  let baseMessage: string | undefined;

  if (error instanceof ApiError) {
    status = error.status;
    data = error.data;
    baseMessage = error.message;
  } else if (isRecord(error)) {
    if (typeof error.status === "number") {
      status = error.status;
    }
    if ("data" in error) {
      data = (error as { data?: unknown }).data;
    }
    if (typeof error.message === "string") {
      baseMessage = error.message;
    }

    if (isRecord(error.response)) {
      const response = error.response as UnknownRecord;
      if (typeof response.status === "number") {
        status = response.status;
      }
      if ("data" in response && response.data !== undefined) {
        data = response.data;
      }
    }
  }

  const detail =
    (isRecord(data) && "detail" in data
      ? (data as UnknownRecord).detail
      : data) ?? data;

  const message = baseMessage ?? extractMessage(detail) ?? extractMessage(data);

  return {
    status,
    data: data as T,
    detail,
    message,
    raw: error,
  };
};

export const isObject = isRecord;

export interface ApiErrorDetails {
  status?: number;
  dataRecord?: UnknownRecord;
  detailRecord?: UnknownRecord;
  detailString?: string;
  backendMessage?: string;
  raw: unknown;
}

export const getApiErrorDetails = (error: unknown): ApiErrorDetails => {
  const parsed = parseApiError(error);
  const dataRecord = isRecord(parsed.data)
    ? (parsed.data as UnknownRecord)
    : undefined;
  const detailRecord = isRecord(parsed.detail)
    ? (parsed.detail as UnknownRecord)
    : undefined;
  const detailString =
    typeof parsed.detail === "string"
      ? parsed.detail
      : typeof detailRecord?.detail === "string"
        ? (detailRecord.detail as string)
        : undefined;

  const backendMessage =
    parsed.message ||
    detailString ||
    extractMessage(detailRecord) ||
    extractMessage(dataRecord);

  return {
    status: parsed.status,
    dataRecord,
    detailRecord,
    detailString,
    backendMessage,
    raw: parsed.raw,
  };
};
