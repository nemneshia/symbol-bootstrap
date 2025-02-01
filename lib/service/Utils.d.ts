import { NetworkType } from 'symbol-sdk';
/**
 * Random utility methods that don't fit other place.
 */
export declare class Utils {
    static secureString(text: string): string;
    static validateIsDefined(value: unknown, message: string): void;
    static validateIsTrue(value: boolean, message: string): void;
    static logSameLineMessage(message: string): void;
    static validatePassword(password: string): string;
    static getNetworkIdentifier(networkType: NetworkType): string;
    static getNetworkName(networkType: NetworkType): string;
    static resolveWorkingDirPath(workingDir: string, path: string): string;
    static pruneEmpty(obj: any): any;
    static getMessage(e: unknown): string;
}
