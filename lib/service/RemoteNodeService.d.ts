import { ChainInfo, RepositoryFactory } from 'symbol-sdk';
import { NodeApi } from 'symbol-statistics-service-typescript-fetch-client';
import { Logger } from '../logger';
import { ConfigPreset, PeerInfo } from '../model';
export interface RepositoryInfo {
    repositoryFactory: RepositoryFactory;
    restGatewayUrl: string;
    chainInfo: ChainInfo;
}
export declare class RemoteNodeService {
    private readonly logger;
    private readonly presetData;
    private readonly offline;
    constructor(logger: Logger, presetData: ConfigPreset, offline: boolean);
    private restUrls;
    resolveCurrentFinalizationEpoch(): Promise<number>;
    getBestFinalizationEpoch(urls: string[]): Promise<number | undefined>;
    getBestRepositoryInfo(url: string | undefined): Promise<RepositoryInfo>;
    private sortByHeight;
    isConnectedToInternet(): Promise<boolean>;
    private getKnownNodeRepositoryInfos;
    getRestUrls(): Promise<string[]>;
    /**
     * Return user friendly role type list
     * @param role combined node role types
     */
    static getNodeRoles(role: number): string;
    getPeerInfos(): Promise<PeerInfo[]>;
    createNodeApiRestClient(statisticsServiceUrl: string): NodeApi;
    resolveRestUrlsForServices(): Promise<{
        restNodes: string[];
        defaultNode: string;
    }>;
}
