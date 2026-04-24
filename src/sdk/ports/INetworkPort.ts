import { ChainInfoDto, MultisigInfoDto, NodeHealthDto, NodeInfoDto } from '../types/Network.js';

/**
 * Port interface for lightweight network / REST-node queries.
 * All methods accept a REST gateway URL string and return plain DTOs.
 * Heavy transaction-lifecycle operations (signing, announcement, listeners) are
 * handled inside the SDK adapter layer and are NOT part of this interface.
 */
export interface INetworkPort {
  /**
   * Fetch the current chain state from a single node.
   * Throws if the node is unreachable.
   */
  getChainInfo(url: string): Promise<ChainInfoDto>;

  /**
   * Fetch static node information (public key, roles, host, …).
   * Throws if the node is unreachable.
   */
  getNodeInfo(url: string): Promise<NodeInfoDto>;

  /**
   * Fetch the liveness status of the api-node and its database.
   * Throws if the node is unreachable.
   */
  getNodeHealth(url: string): Promise<NodeHealthDto>;

  /**
   * Look up multisig graph information for {@link address}.
   * Returns undefined when the account is NOT a multisig account.
   */
  getMultisigInfo(url: string, address: string): Promise<MultisigInfoDto | undefined>;
}
