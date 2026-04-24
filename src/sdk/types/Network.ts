/**
 * Plain data DTOs for network/chain information.
 * None of these types reference symbol-sdk directly.
 */

export interface ChainInfoDto {
  /** Block height as a bigint (avoids UInt64 SDK dependency). */
  readonly height: bigint;
  readonly finalizationEpoch: number;
}

export interface NodeInfoDto {
  readonly publicKey?: string;
  readonly host?: string;
  readonly friendlyName?: string;
  readonly roles?: number;
  readonly networkIdentifier?: number;
  readonly networkGenerationHashSeed?: string;
  readonly nodePublicKey?: string;
}

export interface NodeHealthDto {
  readonly apiNodeStatus: 'Up' | 'Down';
  readonly dbStatus: 'Up' | 'Down';
}

export interface MultisigInfoDto {
  readonly isMultisig: boolean;
  readonly minApproval: number;
  readonly minRemoval: number;
  readonly cosignatoryAddresses: readonly string[];
}

/** Mosaic balance entry for an account. */
export interface MosaicBalanceDto {
  readonly id: string;
  readonly amount: bigint;
}

/** Voting key entry in supplemental public keys. */
export interface VotingKeyDto {
  readonly publicKey: string;
  readonly startEpoch: number;
  readonly endEpoch: number;
}

/** Supplemental public keys for an account (remote, vrf, voting). */
export interface SupplementalPublicKeysDto {
  readonly linked?: string; // remote account public key
  readonly vrf?: string; // VRF account public key
  readonly voting?: readonly VotingKeyDto[];
}

/** Basic account info returned by REST. */
export interface AccountInfoDto {
  readonly address: string;
  readonly mosaics: readonly MosaicBalanceDto[];
  readonly supplementalPublicKeys?: SupplementalPublicKeysDto;
}

/**
 * Aggregated network configuration fetched from a REST node.
 * Used by ITransactionPort to avoid calling multiple REST endpoints separately.
 */
export interface NetworkConfigDto {
  /** Epoch adjustment in seconds (used to compute absolute deadlines). */
  readonly epochAdjustment: number;
  /** Currency mosaic ID as an uppercase hex string (16 chars). */
  readonly currencyMosaicId: string;
  /** Number of decimal places for the currency mosaic (e.g. 6 for XYM). */
  readonly currencyDivisibility: number;
  /** Minimum fee multiplier reported by the node. */
  readonly minFeeMultiplier: number;
  /** Network generation hash seed (hex string) – used when signing transactions. */
  readonly generationHashSeed: string;
  /** Latest finalized block finalization epoch – used for voting key link range validation. */
  readonly latestFinalizedBlockEpoch: number;
  /** Network type identifier byte (104 for mainnet, 152 for testnet). */
  readonly networkIdentifier: number;
}
