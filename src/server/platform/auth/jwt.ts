import { SignJWT, jwtVerify, decodeJwt } from 'jose';
import { jwtConfig } from '@/lib/config';

const secretKey = new TextEncoder().encode(jwtConfig.secret);

export type AccessTokenPayload = {
  userId: string;
  tenantId: string;
  roleCode: string;
  permissions: string[];
};

export type RefreshTokenPayload = {
  userId: string;
  tenantId: string;
};

export type JwtClaims = AccessTokenPayload & {
  iat: number;
  exp: number;
  jti: string;
};

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + jwtConfig.accessTtl)
    .setJti(crypto.randomUUID())
    .sign(secretKey);
}

export async function signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + jwtConfig.refreshTtl)
    .setJti(crypto.randomUUID())
    .sign(secretKey);
}

export async function verifyToken(token: string): Promise<JwtClaims> {
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ['HS256'],
  });
  return payload as unknown as JwtClaims;
}

export function decodeToken(token: string): JwtClaims | null {
  try {
    return decodeJwt(token) as unknown as JwtClaims;
  } catch {
    return null;
  }
}