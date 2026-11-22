export type ApiResponse<T> = {
  code: number;
  message: string;
  data: T | null;
  trace_id: string;
};

export const ErrorCode = {
  UNAUTHORIZED: 40101,
  FORBIDDEN: 40301,
  NOT_FOUND: 40401,
  CONFLICT: 40901,
  AI_SERVICE_UNAVAILABLE: 50301,
  AI_AUTH_FAILED: 50302,
  AI_MODEL_NOT_FOUND: 50303,
  AI_TIMEOUT: 50304,
  BAD_REQUEST: 40001,
  INTERNAL_ERROR: 50001,
} as const;

export function generateTraceId(): string {
  return crypto.randomUUID();
}

export function success<T>(data: T, message = 'ok'): ApiResponse<T> {
  return {
    code: 0,
    message,
    data,
    trace_id: generateTraceId(),
  };
}

export function error(
  code: number,
  message: string,
  details?: Record<string, unknown>,
): ApiResponse<Record<string, unknown> | null> {
  return {
    code,
    message,
    data: details ?? null,
    trace_id: generateTraceId(),
  };
}

export function jsonResponse<T>(response: ApiResponse<T>, status = 200): Response {
  return Response.json(response, { status });
}