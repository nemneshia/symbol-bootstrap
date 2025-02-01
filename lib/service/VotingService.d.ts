import { Logger } from '../logger';
import { ConfigPreset, NodeAccount, NodePreset } from '../model';
import { VotingKeyFileProvider } from './VotingKeyFileProvider';
export interface VotingParams {
    target: string;
    user: string;
    votingKeyFileProvider?: VotingKeyFileProvider;
}
export declare class VotingService {
    private readonly logger;
    protected readonly params: VotingParams;
    private readonly fileSystemService;
    constructor(logger: Logger, params: VotingParams);
    run(presetData: ConfigPreset, nodeAccount: NodeAccount, nodePreset: NodePreset, currentNetworkEpoch: number | undefined, updateVotingKey: boolean | undefined, nemesisBlock: boolean): Promise<boolean>;
}
