import { NetworkType } from 'symbol-sdk';
import { Logger } from '../logger';
import { CertificatePair } from '../model';
import { AccountResolver } from './AccountResolver';
export interface CertificateParams {
    readonly target: string;
    readonly user?: string;
}
export interface CertificateMetadata {
    readonly transportPublicKey: string;
    readonly mainPublicKey: string;
    readonly version: number;
}
export interface NodeCertificates {
    main: CertificatePair;
    transport: CertificatePair;
}
export interface CertificateConfigPreset {
    networkType: NetworkType;
    symbolServerImage: string;
    caCertificateExpirationInDays: number;
    nodeCertificateExpirationInDays: number;
    certificateExpirationWarningInDays: number;
}
export declare enum RenewMode {
    ONLY_WARNING = 0,
    WHEN_REQUIRED = 1,
    ALWAYS = 2
}
export declare class CertificateService {
    private readonly logger;
    private readonly accountResolver;
    protected readonly params: CertificateParams;
    static NODE_CERTIFICATE_FILE_NAME: string;
    static CA_CERTIFICATE_FILE_NAME: string;
    private static readonly METADATA_VERSION;
    private readonly fileSystemService;
    private readonly runtimeService;
    constructor(logger: Logger, accountResolver: AccountResolver, params: CertificateParams);
    run(presetData: CertificateConfigPreset, name: string, providedCertificates: NodeCertificates, renewMode: RenewMode, customCertFolder?: string, randomSerial?: string): Promise<boolean>;
    private createCertificate;
    private shouldGenerateCertificate;
    private createCertCommands;
    willCertificateExpire(symbolServerImage: string, certFolder: string, certificateFileName: string, certificateExpirationWarningInDays: number): Promise<{
        willExpire: boolean;
        expirationDate: string;
    }>;
    private runOpenSslCommand;
    static getCertificates(stdout: string): CertificatePair[];
    static createDerFile(privateKey: string, file: string): void;
    static toAns1(privateKey: string): string;
}
