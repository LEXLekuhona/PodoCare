import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/shared/config/env', () => ({
  getApiBaseUrl: () => 'http://example.test/api/v1',
}));

import { ApiError, apiFetchJson } from './client';

function mockResponse(params: {
  ok: boolean;
  status: number;
  bodyText: string;
  headers?: Record<string, string>;
}): Response {
  const headers = new Headers(params.headers ?? {});
  return {
    ok: params.ok,
    status: params.status,
    headers,
    text: async () => params.bodyText,
  } as unknown as Response;
}

describe('apiFetchJson', () => {
  it('returns undefined for 204', async () => {
    global.fetch = jest.fn(async () => mockResponse({ ok: true, status: 204, bodyText: '' })) as unknown as typeof fetch;
    const res = await apiFetchJson<void>('/x');
    expect(res).toBeUndefined();
  });

  it('throws ApiError for 200 empty body (strict)', async () => {
    global.fetch = jest.fn(async () =>
      mockResponse({ ok: true, status: 200, bodyText: '   ', headers: { 'content-type': 'application/json' } }),
    ) as unknown as typeof fetch;

    await expect(apiFetchJson<{ ok: true }>('/x')).rejects.toBeInstanceOf(ApiError);
    await expect(apiFetchJson<{ ok: true }>('/x')).rejects.toMatchObject({ status: 200 });
  });

  it('throws ApiError for 200 non-json content-type', async () => {
    global.fetch = jest.fn(async () =>
      mockResponse({ ok: true, status: 200, bodyText: '{"a":1}', headers: { 'content-type': 'text/plain' } }),
    ) as unknown as typeof fetch;

    await expect(apiFetchJson<{ a: number }>('/x')).rejects.toMatchObject({ status: 200 });
  });

  it('parses JSON for 200 application/json', async () => {
    global.fetch = jest.fn(async () =>
      mockResponse({ ok: true, status: 200, bodyText: '{"a":1}', headers: { 'content-type': 'application/json; charset=utf-8' } }),
    ) as unknown as typeof fetch;

    await expect(apiFetchJson<{ a: number }>('/x')).resolves.toEqual({ a: 1 });
  });

  it('for non-ok uses response text as fallback message', async () => {
    global.fetch = jest.fn(async () =>
      mockResponse({ ok: false, status: 500, bodyText: 'boom', headers: { 'content-type': 'text/plain' } }),
    ) as unknown as typeof fetch;

    await expect(apiFetchJson('/x')).rejects.toMatchObject({ status: 500, message: 'boom' });
  });

  it('for non-ok prefers payload.message from JSON', async () => {
    global.fetch = jest.fn(async () =>
      mockResponse({
        ok: false,
        status: 400,
        bodyText: JSON.stringify({ message: ['a', 'b'] }),
        headers: { 'content-type': 'application/json' },
      }),
    ) as unknown as typeof fetch;

    await expect(apiFetchJson('/x')).rejects.toMatchObject({ status: 400, message: 'a; b' });
  });
});

