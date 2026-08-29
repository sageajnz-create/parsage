import { createHash, randomBytes } from 'crypto';

export class ReconnectRegistry {
  private tokens = new Map<string, string>();

  issue(clientId: string): string {
    const token = randomBytes(32).toString('base64url');
    this.tokens.set(this.hash(token), clientId);
    return token;
  }

  resolve(token: string): string | null {
    if (!token || token.length > 256) return null;
    return this.tokens.get(this.hash(token)) || null;
  }

  rotate(previousClientId: string, temporaryClientId: string, replacementToken?: string): string {
    this.remove(previousClientId);
    this.remove(temporaryClientId);
    const token = replacementToken || randomBytes(32).toString('base64url');
    this.tokens.set(this.hash(token), previousClientId);
    return token;
  }

  remove(clientId: string): void {
    for (const [hash, mappedId] of this.tokens) {
      if (mappedId === clientId) this.tokens.delete(hash);
    }
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
