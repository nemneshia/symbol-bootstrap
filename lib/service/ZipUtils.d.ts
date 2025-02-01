import { Logger } from '../logger';
export interface ZipItem {
    from: string;
    directory: boolean;
    to: string;
    blacklist?: string[];
}
export declare class ZipUtils {
    private readonly logger;
    constructor(logger: Logger);
    zip(destination: string, items: ZipItem[]): Promise<void>;
    unzip(zipFile: string, innerFolder: string | null, targetFolder: string): Promise<void>;
}
