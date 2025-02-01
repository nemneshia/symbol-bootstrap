export interface KeyPair {
    privateKey: Uint8Array;
    publicKey: Uint8Array;
}
export interface CryptoImplementation {
    name: string;
    createKeyPairFromPrivateKey: (privateKey: Uint8Array) => Promise<KeyPair>;
    sign: (keyPair: KeyPair, data: Uint8Array) => Promise<Uint8Array>;
}
export interface VotingKeyAccount {
    readonly startEpoch: number;
    readonly endEpoch: number;
    readonly publicKey: string;
}
export declare type VotingKeyFile = VotingKeyAccount & {
    filename: string;
};
export declare class VotingUtils {
    private readonly implementation;
    static nobleImplementation: CryptoImplementation;
    static tweetNaClImplementation: CryptoImplementation;
    static implementations: CryptoImplementation[];
    constructor(implementation?: CryptoImplementation);
    insert(result: Uint8Array, value: Uint8Array, index: number): number;
    createVotingFile(secret: string, votingKeyStartEpoch: number, votingKeyEndEpoch: number, unitTestPrivateKeys?: Uint8Array[] | undefined): Promise<Uint8Array>;
    readVotingFile(file: Uint8Array): VotingKeyAccount;
    loadVotingFiles(folder: string): VotingKeyFile[];
}
