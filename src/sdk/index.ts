/**
 * @module src/sdk
 *
 * Single entry-point for all symbol-sdk concerns.
 *
 * Service classes MUST import from this module instead of 'symbol-sdk' directly.
 * This ensures that symbol-sdk version changes only require updates here and in
 * the adapter implementations under src/sdk/adapters/.
 *
 * Contents:
 *   • Domain types   – NetworkType, GeneratedAccount, PublicAccountInfo, …
 *   • Port interfaces – ICryptoPort, INetworkPort
 *   • Adapter classes – SymbolCryptoAdapter, SymbolNetworkAdapter
 *   • SDK re-exports  – complex SDK types that services still need directly
 *                       (Transaction, Account for signing, etc.)
 */

// ── Domain types ─────────────────────────────────────────────────────────────
export type { GeneratedAccount, PublicAccountInfo } from './types/Account.js';
export type {
  AccountInfoDto,
  ChainInfoDto,
  MosaicBalanceDto,
  MultisigInfoDto,
  NetworkConfigDto,
  NodeHealthDto,
  NodeInfoDto,
  SupplementalPublicKeysDto,
  VotingKeyDto,
} from './types/Network.js';
export { NetworkType } from './types/NetworkType.js';
export type { AnnounceConfirmCallback, TransactionDescriptor } from './types/Transaction.js';

// ── Port interfaces ──────────────────────────────────────────────────────────
export type { ICryptoPort } from './ports/ICryptoPort.js';
export type { INetworkPort } from './ports/INetworkPort.js';
export type { ITransactionPort } from './ports/ITransactionPort.js';

// ── Adapter implementations ──────────────────────────────────────────────────
export { SymbolCryptoAdapter } from './adapters/SymbolCryptoAdapter.js';
export { SymbolNetworkAdapter } from './adapters/SymbolNetworkAdapter.js';
export { SymbolTransactionAdapter } from './adapters/SymbolTransactionAdapter.js';
