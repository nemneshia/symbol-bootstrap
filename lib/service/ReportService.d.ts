import { Logger } from '../logger';
import { ConfigPreset } from '../model';
export declare type ReportParams = {
    target: string;
    workingDir: string;
    version?: string;
};
export declare class ReportService {
    private readonly logger;
    protected readonly params: ReportParams;
    static defaultParams: ReportParams;
    private readonly configLoader;
    private readonly fileSystemService;
    constructor(logger: Logger, params: ReportParams);
    private createReportFromFile;
    private createReportsPerNode;
    /**
     *  It generates a .rst config report file per node.
     * @param passedPresetData the preset data,
     */
    run(passedPresetData?: ConfigPreset): Promise<string[]>;
    private getVersion;
    private toRstReport;
    private toCsvReport;
}
