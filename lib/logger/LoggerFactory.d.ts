import { Logger } from './Logger';
import { LogType } from './LogType';
export declare class LoggerFactory {
    static readonly separator = ",";
    private static readonly consoleTransport;
    private static readonly silent;
    private static readonly fileTransport;
    static getLogger(logTypes: string, workingDir?: string): Logger;
    static getLoggerFromTypes(logTypes: LogType[], workingDir?: string): Logger;
}
