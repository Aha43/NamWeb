import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';
import { issueCsrf, verifyCsrf } from './csrf';

function fakeRes() {
  const cookies: Record<string, string> = {};
  const res = {
    req: { secure: false },
    cookie(name: string, value: string) {
      cookies[name] = value;
      return res;
    },
  } as unknown as Response;
  return { res, cookies };
}

const reqWith = (cookie?: string, field?: string) =>
  ({ headers: cookie ? { cookie } : {}, body: field === undefined ? {} : { _csrf: field } }) as Request;

describe('CSRF double-submit', () => {
  it('issues a token, sets the cookie, and verifies a matching field', () => {
    const { res, cookies } = fakeRes();
    const token = issueCsrf(res);
    expect(cookies.nam_csrf).toBe(token);
    expect(verifyCsrf(reqWith(`nam_csrf=${token}`, token))).toBe(true);
  });

  it('rejects a missing field, missing cookie, or mismatch', () => {
    const { res } = fakeRes();
    const token = issueCsrf(res);
    expect(verifyCsrf(reqWith(`nam_csrf=${token}`, undefined))).toBe(false); // no field
    expect(verifyCsrf(reqWith(undefined, token))).toBe(false); // no cookie
    expect(verifyCsrf(reqWith(`nam_csrf=${token}`, 'other'))).toBe(false); // mismatch
  });

  it('reads its cookie from among others', () => {
    expect(verifyCsrf(reqWith('a=1; nam_csrf=xyz; b=2', 'xyz'))).toBe(true);
  });
});
