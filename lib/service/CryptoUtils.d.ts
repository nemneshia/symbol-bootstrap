import { PrivateKeySecurityMode } from '../model';
export declare class CryptoUtils {
    private static readonly ENCRYPT_PREFIX;
    private static readonly ENCRYPTABLE_KEYS;
    static encrypt(value: any, password: string, fieldName?: string): any;
    static getPrivateKeySecurityMode(value: string | undefined): PrivateKeySecurityMode;
    static removePrivateKeysAccordingToSecurityMode(value: any, securityMode: PrivateKeySecurityMode): any;
    static removePrivateKeys(value: any, blacklistNames?: string[]): any;
    static decrypt(value: any, password: string, fieldName?: string): any;
    static encryptedCount(value: any, fieldName?: string): number;
    private static isEncryptableKeyField;
}
