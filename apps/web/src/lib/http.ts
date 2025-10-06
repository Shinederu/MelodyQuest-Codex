const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

type RequestOptions = {
  headers?: Record<string, string>;
};

type JsonResult<T> = {
  ok: boolean;
  data?: T;
  error?: unknown;
  status: number;
};

async function json<T>(method: string, path: string, body?: unknown, options: RequestOptions = {}): Promise<JsonResult<T>> {
  const url = path.startsWith('http')
    ? path
    : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await response.json() : undefined;

    if (!response.ok) {
      return {
        ok: false,
        error: payload || { message: response.statusText },
        status: response.status
      };
    }

    return {
      ok: true,
      data: payload?.data ?? payload,
      status: response.status
    };
  } catch (error) {
    console.error('HTTP error', error);
    return {
      ok: false,
      error,
      status: 0
    };
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => json<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => json<T>('POST', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => json<T>('PATCH', path, body, options),
  json
};
