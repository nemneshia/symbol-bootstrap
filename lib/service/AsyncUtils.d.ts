import { Logger } from '../logger';
/**
 * Async related utility methods.
 */
export declare class AsyncUtils {
    static stopProcess: boolean;
    private static onProcessListener;
    static sleep(ms: number): Promise<any>;
    static poll(logger: Logger, promiseFunction: () => Promise<boolean>, totalPollingTime: number, pollIntervalMs: number): Promise<boolean>;
}
