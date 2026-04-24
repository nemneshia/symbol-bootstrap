import { firstValueFrom } from 'rxjs';
import { Address, RepositoryFactoryHttp } from 'symbol-sdk';
import { INetworkPort } from '../ports/INetworkPort.js';
import { ChainInfoDto, MultisigInfoDto, NodeHealthDto, NodeInfoDto } from '../types/Network.js';

/**
 * Production implementation of INetworkPort backed by symbol-sdk HTTP repositories.
 *
 * This is the ONLY file (outside adapters/) that may import from 'symbol-sdk'
 * for network/REST operations.
 */
export class SymbolNetworkAdapter implements INetworkPort {
  async getChainInfo(url: string): Promise<ChainInfoDto> {
    const factory = new RepositoryFactoryHttp(url);
    const info = await firstValueFrom(factory.createChainRepository().getChainInfo());
    return {
      height: BigInt(info.height.toString()),
      finalizationEpoch: info.latestFinalizedBlock.finalizationEpoch,
    };
  }

  async getNodeInfo(url: string): Promise<NodeInfoDto> {
    const factory = new RepositoryFactoryHttp(url);
    const info = await firstValueFrom(factory.createNodeRepository().getNodeInfo());
    return {
      publicKey: info.publicKey,
      host: info.host,
      friendlyName: info.friendlyName,
      roles: Array.isArray(info.roles) ? info.roles.reduce((acc: number, r: number) => acc + r, 0) : (info.roles as unknown as number),
      networkIdentifier: info.networkIdentifier,
      networkGenerationHashSeed: info.networkGenerationHashSeed,
      nodePublicKey: info.nodePublicKey,
    };
  }

  async getNodeHealth(url: string): Promise<NodeHealthDto> {
    const factory = new RepositoryFactoryHttp(url);
    const health = await firstValueFrom(factory.createNodeRepository().getNodeHealth());
    return {
      apiNodeStatus: String(health.apiNode).toLowerCase() === 'up' ? 'Up' : 'Down',
      dbStatus: String(health.db).toLowerCase() === 'up' ? 'Up' : 'Down',
    };
  }

  async getMultisigInfo(url: string, address: string): Promise<MultisigInfoDto | undefined> {
    try {
      const factory = new RepositoryFactoryHttp(url);
      const info = await firstValueFrom(factory.createMultisigRepository().getMultisigAccountInfo(Address.createFromRawAddress(address)));
      if (!info.isMultisig()) {
        return undefined;
      }
      return {
        isMultisig: true,
        minApproval: info.minApproval,
        minRemoval: info.minRemoval,
        cosignatoryAddresses: info.cosignatoryAddresses.map((a) => a.plain()),
      };
    } catch {
      return undefined;
    }
  }
}
