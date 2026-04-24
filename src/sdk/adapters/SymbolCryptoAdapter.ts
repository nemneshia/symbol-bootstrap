import {
  Account,
  Address,
  Convert,
  Crypto,
  DtoMapping,
  MosaicId,
  MosaicNonce,
  PublicAccount,
  NetworkType as SdkNetworkType,
} from 'symbol-sdk';
import { ICryptoPort } from '../ports/ICryptoPort.js';
import { GeneratedAccount, PublicAccountInfo } from '../types/Account.js';
import { NetworkType } from '../types/NetworkType.js';

/**
 * Production implementation of ICryptoPort backed by symbol-sdk.
 *
 * This is the ONLY file (outside adapters/) that may import from 'symbol-sdk'
 * for cryptographic primitives.  All service classes receive this via DI.
 */
export class SymbolCryptoAdapter implements ICryptoPort {
  // ── private helpers ───────────────────────────────────────────────────────

  private sdkType(networkType: NetworkType): SdkNetworkType {
    // Domain NetworkType values are identical to SDK values – a direct cast is safe.
    return networkType as unknown as SdkNetworkType;
  }

  private accountToDto(account: Account): GeneratedAccount {
    return {
      privateKey: account.privateKey,
      publicKey: account.publicKey,
      address: account.address.plain(),
    };
  }

  // ── ICryptoPort ───────────────────────────────────────────────────────────

  generateAccount(networkType: NetworkType): GeneratedAccount {
    return this.accountToDto(Account.generateNewAccount(this.sdkType(networkType)));
  }

  createAccountFromPrivateKey(privateKey: string, networkType: NetworkType): GeneratedAccount {
    return this.accountToDto(Account.createFromPrivateKey(privateKey, this.sdkType(networkType)));
  }

  createPublicAccount(publicKey: string, networkType: NetworkType): PublicAccountInfo {
    const pa = PublicAccount.createFromPublicKey(publicKey, this.sdkType(networkType));
    return { publicKey: pa.publicKey, address: pa.address.plain() };
  }

  getAddressFromPublicKey(publicKey: string, networkType: NetworkType): string {
    return Address.createFromPublicKey(publicKey, this.sdkType(networkType)).plain();
  }

  createAddressFromRawAddress(rawAddress: string): string {
    return Address.createFromRawAddress(rawAddress).plain();
  }

  createMosaicId(nonceNumber: number, ownerAddress: string): string {
    const address = Address.createFromRawAddress(ownerAddress);
    return MosaicId.createFromNonce(MosaicNonce.createFromNumber(nonceNumber), address).toHex();
  }

  randomBytes(count: number): Uint8Array {
    return Crypto.randomBytes(count);
  }

  randomHex(byteCount: number): string {
    return Convert.uint8ToHex(Crypto.randomBytes(byteCount));
  }

  hexToUint8(hex: string): Uint8Array {
    return Convert.hexToUint8(hex);
  }

  uint8ToHex(bytes: Uint8Array): string {
    return Convert.uint8ToHex(bytes);
  }

  numberToUint8Array(value: number, size: number): Uint8Array {
    return Convert.numberToUint8Array(value, size);
  }

  uintArray8ToNumber(bytes: Uint8Array): number {
    return Convert.uintArray8ToNumber(bytes);
  }

  isHexString(value: string, byteCount?: number): boolean {
    return Convert.isHexString(value, byteCount);
  }

  encrypt(value: string, password: string): string {
    return Crypto.encrypt(value, password);
  }

  decrypt(encryptedValue: string, password: string): string {
    return Crypto.decrypt(encryptedValue, password);
  }

  parseServerDurationToSeconds(duration: string): number {
    return DtoMapping.parseServerDuration(duration).seconds();
  }
}
