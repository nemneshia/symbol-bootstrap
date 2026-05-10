import {
  ChainRoutesApi,
  Configuration,
  MultisigRoutesApi,
  NodeRoutesApi,
  NodeStatusEnum,
} from 'symbol-openapi-typescript-fetch-client';

import { INetworkPort } from '../ports/INetworkPort.js';
import { ChainInfoDto, MultisigInfoDto, NodeHealthDto, NodeInfoDto } from '../types/Network.js';

const cfg = (url: string) => new Configuration({ basePath: url, fetchApi: fetch });

export class SymbolNetworkAdapter implements INetworkPort {
  async getChainInfo(url: string): Promise<ChainInfoDto> {
    const info = await new ChainRoutesApi(cfg(url)).getChainInfo();
    return {
      height: BigInt(info.height),
      finalizationEpoch: info.latestFinalizedBlock.finalizationEpoch,
    };
  }

  async getNodeInfo(url: string): Promise<NodeInfoDto> {
    const info = await new NodeRoutesApi(cfg(url)).getNodeInfo();
    return {
      publicKey: info.publicKey,
      host: info.host,
      friendlyName: info.friendlyName,
      roles: info.roles,
      networkIdentifier: info.networkIdentifier,
      networkGenerationHashSeed: info.networkGenerationHashSeed,
      nodePublicKey: info.nodePublicKey,
    };
  }

  async getNodeHealth(url: string): Promise<NodeHealthDto> {
    const health = await new NodeRoutesApi(cfg(url)).getNodeHealth();
    return {
      apiNodeStatus: health.status.apiNode === NodeStatusEnum.Up ? 'Up' : 'Down',
      dbStatus: health.status.db === NodeStatusEnum.Up ? 'Up' : 'Down',
    };
  }

  async getMultisigInfo(url: string, address: string): Promise<MultisigInfoDto | undefined> {
    try {
      const info = await new MultisigRoutesApi(cfg(url)).getAccountMultisig({ address });
      const multisig = info.multisig;
      if (!multisig.minApproval && !multisig.minRemoval) {
        return undefined;
      }
      return {
        isMultisig: true,
        minApproval: multisig.minApproval,
        minRemoval: multisig.minRemoval,
        cosignatoryAddresses: multisig.cosignatoryAddresses,
      };
    } catch {
      return undefined;
    }
  }
}
