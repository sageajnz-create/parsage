import { createHash, randomBytes } from 'node:crypto';
import { OAuth2Client, TokenPayload } from 'google-auth-library';

export interface AuthProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

interface Session {
  profile: AuthProfile;
  expiresAt: number;
}

interface Pairing {
  secretHash: string;
  profile: AuthProfile | null;
  expiresAt: number;
}

type TokenVerifier = (credential: string, audience: string) => Promise<TokenPayload | undefined>;

const SESSION_COOKIE = 'parsage_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60_000;

export class AuthService {
  private sessions = new Map<string, Session>();
  private pairings = new Map<string, Pairing>();
  private oauthClient = new OAuth2Client();
  private readonly verifyToken: TokenVerifier;

  constructor(
    public readonly clientId: string,
    verifyToken?: TokenVerifier
  ) {
    this.verifyToken = verifyToken || (async (credential, audience) => {
      const ticket = await this.oauthClient.verifyIdToken({ idToken: credential, audience });
      return ticket.getPayload();
    });
  }

  get configured(): boolean {
    return this.clientId.endsWith('.apps.googleusercontent.com') && !this.clientId.includes('parsagedemoapp');
  }

  async login(credential: string): Promise<{ token: string; profile: AuthProfile }> {
    if (!this.configured) throw new Error('Google authentication is not configured.');
    if (!credential || credential.length > 10_000) throw new Error('Invalid Google credential.');

    const payload = await this.verifyToken(credential, this.clientId);
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new Error('Google did not return a verified account identity.');
    }

    const profile: AuthProfile = {
      id: payload.sub,
      name: payload.name || payload.given_name || 'Google User',
      email: payload.email,
      avatarUrl: payload.picture || ''
    };
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(this.hashToken(token), {
      profile,
      expiresAt: Date.now() + SESSION_DURATION_MS
    });
    return { token, profile };
  }

  getProfile(cookieHeader?: string): AuthProfile | null {
    const token = parseCookies(cookieHeader)[SESSION_COOKIE];
    if (!token) return null;
    const key = this.hashToken(token);
    const session = this.sessions.get(key);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(key);
      return null;
    }
    return session.profile;
  }

  logout(cookieHeader?: string): void {
    const token = parseCookies(cookieHeader)[SESSION_COOKIE];
    if (token) this.sessions.delete(this.hashToken(token));
  }

  createPairing(): { id: string; secret: string } {
    const id = randomBytes(18).toString('base64url');
    const secret = randomBytes(32).toString('base64url');
    this.pairings.set(id, {
      secretHash: this.hashToken(secret),
      profile: null,
      expiresAt: Date.now() + 5 * 60_000
    });
    return { id, secret };
  }

  completePairing(id: string, profile: AuthProfile): boolean {
    const pairing = this.pairings.get(id);
    if (!pairing || pairing.expiresAt <= Date.now()) {
      this.pairings.delete(id);
      return false;
    }
    pairing.profile = profile;
    return true;
  }

  claimPairing(id: string, secret: string): { token: string; profile: AuthProfile } | null {
    const pairing = this.pairings.get(id);
    if (!pairing || pairing.expiresAt <= Date.now() || pairing.secretHash !== this.hashToken(secret) || !pairing.profile) {
      if (pairing?.expiresAt && pairing.expiresAt <= Date.now()) this.pairings.delete(id);
      return null;
    }
    this.pairings.delete(id);
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(this.hashToken(token), {
      profile: pairing.profile,
      expiresAt: Date.now() + SESSION_DURATION_MS
    });
    return { token, profile: pairing.profile };
  }

  sessionCookie(token: string, secure = false): string {
    return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_DURATION_MS / 1000}${secure ? '; Secure' : ''}`;
  }

  clearCookie(secure = false): string {
    return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

export function parseCookies(header = ''): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = value;
  }
  return cookies;
}
