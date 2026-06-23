const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1'

export class ApiError extends Error {
  status: number
  code: string
  fieldErrors?: Record<string, string[]>

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })
  if (response.status === 204) return undefined as T
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload.error?.code ?? 'API_ERROR',
      payload.error?.message ?? 'Cererea a eșuat',
      payload.error?.fieldErrors,
    )
  }
  return payload as T
}

export function jsonBody(value: unknown) {
  return JSON.stringify(value)
}
