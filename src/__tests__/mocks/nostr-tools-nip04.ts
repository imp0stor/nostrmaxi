export async function encrypt(_secretKey: string, _pubkey: string, plaintext: string): Promise<string> {
  return `enc:${plaintext}`;
}

export async function decrypt(): Promise<string> {
  throw new Error('Mock decrypt unavailable');
}
