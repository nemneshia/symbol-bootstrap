import { GeneratedAccount, PublicAccountInfo } from '../types/Account.js';
import { NetworkType } from '../types/NetworkType.js';

/**
 * Port interface for all cryptographic and encoding operations that depend on symbol-sdk.
 * Inject this instead of importing symbol-sdk directly in service classes.
 */
export interface ICryptoPort {
  // ── Account operations ─────────────────────────────────────────────────────

  /** Generate a brand-new random account for the given network. */
  generateAccount(networkType: NetworkType): GeneratedAccount;

  /** Reconstruct a full account from its hex private key. */
  createAccountFromPrivateKey(privateKey: string, networkType: NetworkType): GeneratedAccount;

  /** Build a public-only account view from a hex public key. */
  createPublicAccount(publicKey: string, networkType: NetworkType): PublicAccountInfo;

  /** Derive the plain address string from a hex public key. */
  getAddressFromPublicKey(publicKey: string, networkType: NetworkType): string;

  /** Normalise a raw address string to the plain (no-dash) form. */
  createAddressFromRawAddress(rawAddress: string): string;

  // ── Mosaic operations ──────────────────────────────────────────────────────

  /**
   * Derive a mosaic ID hex from a sequential nonce and the owner address.
   * @param nonceNumber   zero-based mosaic index
   * @param ownerAddress  plain address of the nemesis signer
   */
  createMosaicId(nonceNumber: number, ownerAddress: string): string;

  // ── Random bytes ──────────────────────────────────────────────────────────

  /** Return {@link count} cryptographically-random bytes. */
  randomBytes(count: number): Uint8Array;

  /** Return {@link byteCount} cryptographically-random bytes encoded as an uppercase hex string. */
  randomHex(byteCount: number): string;

  // ── Encoding helpers ──────────────────────────────────────────────────────

  hexToUint8(hex: string): Uint8Array;
  uint8ToHex(bytes: Uint8Array): string;
  numberToUint8Array(value: number, size: number): Uint8Array;
  uintArray8ToNumber(bytes: Uint8Array): number;

  /** Return true when {@link value} is a valid uppercase-hex string of {@link byteCount} bytes (or any length if omitted). */
  isHexString(value: string, byteCount?: number): boolean;

  // ── Symmetric encryption ──────────────────────────────────────────────────

  /** Encrypt a plain-text string with a password. Returns the cipher text only (no prefix). */
  encrypt(value: string, password: string): string;

  /** Decrypt a cipher text produced by {@link encrypt}. */
  decrypt(encryptedValue: string, password: string): string;

  // ── Duration parsing ──────────────────────────────────────────────────────

  /**
   * Parse a Symbol server duration string (e.g. "1h 30m") and return the
   * equivalent number of seconds.
   */
  parseServerDurationToSeconds(duration: string): number;
}
