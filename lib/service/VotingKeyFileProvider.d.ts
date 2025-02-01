import { Logger } from '../logger';
import { ConfigPreset, NodeAccount, NodePreset } from '../model';
export interface VotingKeyParams {
    presetData: ConfigPreset;
    nodeAccount: NodeAccount;
    nodePreset: NodePreset;
    votingKeysFolder: string;
    privateKeyTreeFileName: string;
    votingKeyStartEpoch: number;
    votingKeyEndEpoch: number;
}
export interface VotingKeyCreationResult {
    publicKey: string;
}
export interface VotingKeyFileProvider {
    createVotingFile(params: VotingKeyParams): Promise<VotingKeyCreationResult>;
}
export declare class NativeVotingKeyFileProvider implements VotingKeyFileProvider {
    private readonly logger;
    private readonly runtimeService;
    constructor(logger: Logger);
    createVotingFile({ presetData, votingKeysFolder, privateKeyTreeFileName, votingKeyStartEpoch, votingKeyEndEpoch, }: VotingKeyParams): Promise<VotingKeyCreationResult>;
}
export declare class CatapultVotingKeyFileProvider implements VotingKeyFileProvider {
    private readonly logger;
    private readonly user;
    private readonly runtimeService;
    constructor(logger: Logger, user: string);
    createVotingFile({ presetData, votingKeysFolder, privateKeyTreeFileName, votingKeyStartEpoch, votingKeyEndEpoch, }: VotingKeyParams): Promise<VotingKeyCreationResult>;
}
