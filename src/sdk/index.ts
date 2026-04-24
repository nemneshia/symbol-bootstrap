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
export type { ChainInfoDto, MultisigInfoDto, NodeHealthDto, NodeInfoDto } from './types/Network.js';
export { NetworkType } from './types/NetworkType.js';

// ── Port interfaces ──────────────────────────────────────────────────────────
export type { ICryptoPort } from './ports/ICryptoPort.js';
export type { INetworkPort } from './ports/INetworkPort.js';

// ── Adapter implementations ──────────────────────────────────────────────────
export { SymbolCryptoAdapter } from './adapters/SymbolCryptoAdapter.js';
export { SymbolNetworkAdapter } from './adapters/SymbolNetworkAdapter.js';

// ── symbol-sdk re-exports ────────────────────────────────────────────────────
// These types are still used directly by services that perform transaction
// signing and announcement.  Centralising the re-export here means only this
// file needs updating if the SDK renames or moves these types.
export {
  Account,
  AccountInfo,
  AccountKeyLinkTransaction,
  Address,
  AggregateTransaction,
  Convert,
  Crypto,
  Currency,
  Deadline,
  DtoMapping,
  LinkAction,
  LockFundsTransaction,
  Mosaic,
  MosaicId,
  MultisigAccountInfo,
  MultisigAccountModificationTransaction,
  PlainMessage,
  PublicAccount,
  RepositoryFactoryHttp,
  RoleType,
  SignedTransaction,
  Transaction,
  TransactionMapping,
  TransactionService,
  TransactionType,
  TransferTransaction,
  UInt64,
  VotingKeyLinkTransaction,
  VrfKeyLinkTransaction,
} from 'symbol-sdk';
export type { IListener, RepositoryFactory, UnresolvedAddress } from 'symbol-sdk';
