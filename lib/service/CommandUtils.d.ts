import { flags } from '@oclif/command';
import { IOptionFlag } from '@oclif/command/lib/flags';
import { PublicAccount } from 'symbol-sdk';
import { Logger, LogType } from '../logger';
import { Password } from './YamlUtils';
export declare class CommandUtils {
    static passwordPromptDefaultMessage: string;
    static helpFlag: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
    static targetFlag: flags.IOptionFlag<string>;
    static passwordFlag: flags.IOptionFlag<string | undefined>;
    static noPasswordFlag: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
    static offlineFlag: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
    static showBanner(): void;
    static getPasswordFlag(description: string): IOptionFlag<string | undefined>;
    static isValidPassword(input: string | undefined): boolean | string;
    static isValidPrivateKey(input: string): boolean | string;
    static resolvePassword(logger: Logger, providedPassword: Password | undefined, noPassword: boolean, message: string, log: boolean): Promise<string | undefined>;
    /**
     * Returns account details formatted (ready to print)
     */
    static formatAccount(account: PublicAccount, wrapped?: boolean): string;
    /**
     * It returns the flag that can be used to tune the class of logger.
     * @param defaultLogTypes the default logger to be used if not provided.
     */
    static getLoggerFlag(...defaultLogTypes: LogType[]): IOptionFlag<string>;
}
