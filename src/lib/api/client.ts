/**
 * Custom fetch client for Kubb-generated hooks.
 * All requests go through /api/proxy which handles auth forwarding.
 */

export type RequestConfig<TData = unknown> = {
  url?: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  params?: Record<string, string>;
  data?: TData | FormData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type ResponseConfig<TData = unknown> = {
  data: TData;
  status: number;
  headers: Record<string, string>;
};

export type ResponseErrorConfig<TError = unknown> = TError;

export type Client = typeof client;

export async function client<TData, TError = Error, TRequest = unknown>(
  config: RequestConfig<TRequest>
): Promise<ResponseConfig<TData>> {
  const { url = "", method, data, headers = {}, params, signal } = config;

  // Prefix with /api/proxy so requests go through the Next.js proxy
  const proxyUrl = `/api/proxy${url}`;
  const queryString = params
    ? "?" + new URLSearchParams(params).toString()
    : "";

  const fetchUrl = `${proxyUrl}${queryString}`;

  const fetchOptions: RequestInit = {
    method,
    headers: { ...headers },
    credentials: "include",
    signal,
  };

  if (data instanceof FormData) {
    fetchOptions.body = data;
  } else if (data !== undefined && data !== null) {
    (fetchOptions.headers as Record<string, string>)["Content-Type"] =
      "application/json";
    fetchOptions.body = JSON.stringify(data);
  }

  const response = await fetch(fetchUrl, fetchOptions);

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type");
  let responseData: TData;

  if (contentType && !contentType.includes("application/json")) {
    responseData = (await response.blob()) as unknown as TData;
  } else {
    responseData = await response.json();
  }

  return {
    data: responseData,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
  };
}

export default client;
