import { NetworkType } from 'symbol-sdk';
import { VotingKeyFile } from '../service';
export interface CertificatePair {
    privateKey?: string;
    publicKey: string;
}
export interface ConfigAccount extends CertificatePair {
    address: string;
}
export interface NodeAccount {
    main: ConfigAccount;
    transport: ConfigAccount;
    remote?: ConfigAccount;
    vrf?: ConfigAccount;
    voting?: VotingKeyFile[];
    roles: string;
    name: string;
    friendlyName: string;
}
export interface MosaicAccounts {
    name: string;
    id: string;
    accounts: ConfigAccount[];
}
export interface Addresses {
    version: number;
    nodes?: NodeAccount[];
    nemesisGenerationHashSeed: string;
    sinkAddress?: string;
    nemesisSigner?: ConfigAccount;
    networkType: NetworkType;
    mosaics?: MosaicAccounts[];
}
