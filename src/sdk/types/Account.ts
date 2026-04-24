/**
 * Plain data object for a generated (full) account.
 * Does NOT expose any symbol-sdk Account instance.
 */
export interface GeneratedAccount {
  readonly privateKey: string;
  readonly publicKey: string;
  readonly address: string;
}

/**
 * Plain data object for a public-only account (no private key).
 */
export interface PublicAccountInfo {
  readonly publicKey: string;
  readonly address: string;
}
