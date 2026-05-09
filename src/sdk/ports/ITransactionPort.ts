import type { Logger } from '../../logger/Logger.js';
import type { VotingKeyAccount } from '../../utils/VotingUtils.js';
import type { AccountInfoDto, NetworkConfigDto } from '../types/Network.js';
import type { AnnounceConfirmCallback, TransactionDescriptor } from '../types/Transaction.js';

/**
 * Port interface for all Symbol transaction operations (building, signing,
 * announcing, and waiting for confirmation).
 *
 * Implementations back this with symbol-sdk v3 + REST via
 * symbol-openapi-typescript-fetch-client + WebSocket (ws).
 *
 * Service classes MUST NOT import from 'symbol-sdk' directly – they
 * use this port instead.
 */
export interface ITransactionPort {
  // ── Network info ─────────────────────────────────────────────────────────

  /**
   * Fetch aggregated network configuration from a single REST node.
   * Makes several REST calls internally (node/info, chain/info, fees, etc.).
   */
  getNetworkConfig(url: string): Promise<NetworkConfigDto>;

  /**
   * Fetch account information (address + mosaic balances).
   * Returns undefined when the account does not yet exist on-chain.
   */
  getAccountInfo(url: string, address: string): Promise<AccountInfoDto | undefined>;

  // ── Deadline helper ──────────────────────────────────────────────────────

  /**
   * Compute a network-compatible deadline timestamp
   * (milliseconds since the Symbol network epoch).
   *
   * @param networkConfig  Network configuration fetched from the node.
   * @param durationSeconds  Time-to-live in seconds (default 7200 = 2 h).
   */
  computeDeadlineMs(networkConfig: NetworkConfigDto, durationSeconds?: number): bigint;

  // ── Transaction descriptor builders ─────────────────────────────────────
  // Each method returns a plain TransactionDescriptor (a Record<string,unknown>)
  // with the symbol-sdk v3 typed-descriptor field names set.  Signing and fee
  // finalisation happen later inside the announce* methods.

  createVrfKeyLinkDescriptor(
    vrfPublicKey: string,
    action: 'link' | 'unlink',
    signerPublicKey: string
  ): TransactionDescriptor;

  createAccountKeyLinkDescriptor(
    remotePublicKey: string,
    action: 'link' | 'unlink',
    signerPublicKey: string
  ): TransactionDescriptor;

  createVotingKeyLinkDescriptor(
    votingFile: VotingKeyAccount,
    action: 'link' | 'unlink',
    signerPublicKey: string
  ): TransactionDescriptor;

  createMultisigModificationDescriptor(
    additions: readonly string[],
    deletions: readonly string[],
    minApprovalDelta: number,
    minRemovalDelta: number,
    signerPublicKey: string
  ): TransactionDescriptor;

  /**
   * Creates a zero-amount self-transfer descriptor used as the "trigger"
   * inner transaction when the service-provider flow requires a bonded aggregate.
   */
  createSelfTransferDescriptor(
    recipientAddress: string,
    currencyMosaicId: string,
    signerPublicKey: string
  ): TransactionDescriptor;

  /** Returns true when the descriptor represents a multisig account modification. */
  isMultisigModification(descriptor: TransactionDescriptor): boolean;

  // ── Nemesis-specific (sign-only, no announcement) ────────────────────────

  /**
   * Build a fully signed transaction from a descriptor and return its
   * hex-encoded payload.  Used by NemesisConfigurationService to write
   * transaction binary files.
   *
   * @param descriptor       Transaction descriptor (type + fields).
   * @param signerPrivateKey Signer private key as hex.
   * @param networkIdentifier Network identifier byte (104 mainnet, 152 testnet).
   * @param generationHashSeed Hex generation hash seed.
   */
  buildSignedPayload(
    descriptor: TransactionDescriptor,
    signerPrivateKey: string,
    networkIdentifier: number,
    generationHashSeed: string
  ): string;

  /**
   * Compute the transaction hash of an already-serialised (signed) payload.
   *
   * @param hexPayload        Hex-encoded signed transaction payload.
   * @param generationHashSeed Hex generation hash seed.
   * @param networkIdentifier Network identifier byte.
   */
  computeTransactionHash(
    hexPayload: string,
    generationHashSeed: string,
    networkIdentifier: number
  ): string;

  // ── Announce flows ────────────────────────────────────────────────────────

  /**
   * Sign a single transaction, optionally prompt via confirmFn, then announce
   * and wait for on-chain confirmation.
   */
  announceSimple(
    descriptor: TransactionDescriptor,
    signerPrivateKey: string,
    networkConfig: NetworkConfigDto,
    url: string,
    providedMaxFee: number | undefined,
    confirmFn: AnnounceConfirmCallback,
    logger: Logger
  ): Promise<boolean>;

  /**
   * Wrap descriptors as inner transactions of an aggregate-complete, sign
   * (with optional cosignatories), and announce.
   */
  announceAggregateComplete(
    descriptors: readonly TransactionDescriptor[],
    mainPublicKey: string,
    signerPrivateKey: string,
    cosignerPrivateKeys: readonly string[],
    networkConfig: NetworkConfigDto,
    url: string,
    requiredCosignatures: number,
    providedMaxFee: number | undefined,
    confirmFn: AnnounceConfirmCallback,
    logger: Logger
  ): Promise<boolean>;

  /**
   * Wrap descriptors in an aggregate-bonded, create the hash-lock, announce
   * both, and wait for confirmation via WebSocket.
   */
  announceAggregateBonded(
    descriptors: readonly TransactionDescriptor[],
    mainPublicKey: string,
    signerPrivateKey: string,
    cosignerPrivateKeys: readonly string[],
    requiredCosignatures: number,
    networkConfig: NetworkConfigDto,
    url: string,
    providedMaxFee: number | undefined,
    confirmFn: AnnounceConfirmCallback,
    logger: Logger
  ): Promise<boolean>;
}
