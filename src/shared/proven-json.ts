export function safeJsonParse<T>(raw: string, errorMessage='Invalid JSON payload'): T {
  try { return JSON.parse(raw) as T; } catch { throw new Error(errorMessage); }
}
