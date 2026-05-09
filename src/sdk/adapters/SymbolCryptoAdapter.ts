import {
  createCipheriv,
  createDecipheriv,
  randomBytes as nodeRandomBytes,
  pbkdf2Sync,
} from 'crypto';
import { PrivateKey, PublicKey, utils } from 'symbol-sdk';
import { Address, SymbolFacade, generateMosaicId } from 'symbol-sdk/symbol';

import { ICryptoPort } from '../ports/ICryptoPort.js';
import { GeneratedAccount, PublicAccountInfo } from '../types/Account.js';
import { NetworkType } from '../types/NetworkType.js';

/**
 * Production implementation of ICryptoPort backed by symbol-sdk v3.
 *
 * This is the ONLY file (outside adapters/) that may import from 'symbol-sdk'
 * for cryptographic primitives.  All service classes receive this via DI.
 */
export class SymbolCryptoAdapter implements ICryptoPort {
  // ── private helpers ───────────────────────────────────────────────────────

  private networkName(networkType: NetworkType): string {
    return networkType === NetworkType.MAIN_NET ? 'mainnet' : 'testnet';
  }

  private facade(networkType: NetworkType): SymbolFacade {
    return new SymbolFacade(this.networkName(networkType));
  }

  // ── ICryptoPort ───────────────────────────────────────────────────────────

  generateAccount(networkType: NetworkType): GeneratedAccount {
    const privateKey = PrivateKey.random();
    const facade = this.facade(networkType);
    const account = facade.createAccount(privateKey);
    return {
      privateKey: privateKey.toString(),
      publicKey: account.publicKey.toString(),
      address: account.address.toString(),
    };
  }

  createAccountFromPrivateKey(privateKey: string, networkType: NetworkType): GeneratedAccount {
    const pk = new PrivateKey(privateKey);
    const facade = this.facade(networkType);
    const account = facade.createAccount(pk);
    return {
      privateKey: pk.toString(),
      publicKey: account.publicKey.toString(),
      address: account.address.toString(),
    };
  }

  createPublicAccount(publicKey: string, networkType: NetworkType): PublicAccountInfo {
    const pk = new PublicKey(publicKey);
    const facade = this.facade(networkType);
    const account = facade.createPublicAccount(pk);
    return {
      publicKey: account.publicKey.toString(),
      address: account.address.toString(),
    };
  }

  getAddressFromPublicKey(publicKey: string, networkType: NetworkType): string {
    const pk = new PublicKey(publicKey);
    const facade = this.facade(networkType);
    return facade.network.publicKeyToAddress(pk).toString();
  }

  createAddressFromRawAddress(rawAddress: string): string {
    return new Address(rawAddress).toString();
  }

  createMosaicId(nonceNumber: number, ownerAddress: string): string {
    const address = new Address(ownerAddress);
    const id = generateMosaicId(address, nonceNumber);
    // Convert to 16-char uppercase hex (matching v2 MosaicId.toHex() format)
    return id.toString(16).toUpperCase().padStart(16, '0');
  }

  randomBytes(count: number): Uint8Array {
    return nodeRandomBytes(count);
  }

  randomHex(byteCount: number): string {
    return utils.uint8ToHex(nodeRandomBytes(byteCount));
  }

  hexToUint8(hex: string): Uint8Array {
    return utils.hexToUint8(hex);
  }

  uint8ToHex(bytes: Uint8Array): string {
    return utils.uint8ToHex(bytes);
  }

  numberToUint8Array(value: number, size: number): Uint8Array {
    // Little-endian encoding (matching v2 Convert.numberToUint8Array)
    const result = new Uint8Array(size);
    let remaining = value >>> 0;
    for (let i = 0; i < size; i++) {
      result[i] = remaining & 0xff;
      remaining = remaining >>> 8;
    }
    return result;
  }

  uintArray8ToNumber(bytes: Uint8Array): number {
    // Little-endian decoding (matching v2 Convert.uintArray8ToNumber)
    let result = 0;
    for (let i = 0; i < bytes.length; i++) {
      result |= bytes[i] << (8 * i);
    }
    return result >>> 0;
  }

  isHexString(value: string, byteCount?: number): boolean {
    if (!/^[0-9A-Fa-f]*$/.test(value)) return false;
    if (byteCount !== undefined) return value.length === byteCount;
    return true;
  }

  encrypt(value: string, password: string): string {
    const salt = nodeRandomBytes(16);
    const key = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = nodeRandomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = (
      cipher as ReturnType<typeof createCipheriv> & { getAuthTag(): Buffer }
    ).getAuthTag();
    return Buffer.concat([salt, iv, tag, encrypted]).toString('hex').toUpperCase();
  }

  decrypt(encryptedValue: string, password: string): string {
    const data = Buffer.from(encryptedValue, 'hex');
    if (data.length < 44) throw new Error('暗号化された値が不正です。');
    const salt = data.subarray(0, 16);
    const iv = data.subarray(16, 28);
    const tag = data.subarray(28, 44);
    const ciphertext = data.subarray(44);
    const key = pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    (
      decipher as ReturnType<typeof createDecipheriv> & { setAuthTag(tag: Buffer): void }
    ).setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  parseServerDurationToSeconds(duration: string): number {
    if (!duration) throw new Error(`期間フォーマットが不正です: ${duration}`);
    // Supports formats like: '30s', '1m', '1h', '1d', '1h30m', '2h30m15s'
    const re = /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
    const m = re.exec(duration);
    if (!m || duration === '') throw new Error(`期間フォーマットが不正です: ${duration}`);
    const days = m[1] ? parseInt(m[1], 10) : 0;
    const hours = m[2] ? parseInt(m[2], 10) : 0;
    const minutes = m[3] ? parseInt(m[3], 10) : 0;
    const seconds = m[4] ? parseInt(m[4], 10) : 0;
    if (!m[1] && !m[2] && !m[3] && !m[4])
      throw new Error(`期間フォーマットが不正です: ${duration}`);
    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
  }
}
