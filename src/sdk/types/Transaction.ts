/**
 * Plain transaction descriptor – a simple data object that ITransactionPort
 * can use to build, sign and announce a Symbol transaction.
 *
 * Keys mirror the symbol-sdk v3 typed-descriptor field names.
 */
export interface TransactionDescriptor {
  readonly type: string; // e.g. 'vrf_key_link_transaction_v1'
  readonly [key: string]: unknown;
}

/**
 * Callback invoked by ITransactionPort.announce* methods before broadcasting.
 * Receives a human-readable description of the transaction to be announced.
 * Return true to proceed, false to cancel.
 */
export type AnnounceConfirmCallback = (description: string) => Promise<boolean>;
