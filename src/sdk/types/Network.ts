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
