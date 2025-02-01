import { Logger } from '../logger';
import { RuntimeService } from './RuntimeService';
export interface VerifyReport {
    platform: string;
    lines: ReportLine[];
}
export interface ReportLine {
    header: string;
    message: string;
    recommendation?: string;
}
export interface ExpectedVersions {
    node: string;
    docker: string;
    dockerCompose: string;
}
export interface VerifyAction {
    shouldRun(lines: ReportLine[]): boolean;
    verify(): Promise<ReportLine>;
}
export declare class AppVersionService {
    private readonly logger;
    private readonly runtimeService;
    static readonly semverOptions: {
        loose: boolean;
    };
    constructor(logger: Logger, runtimeService: RuntimeService);
    loadVersion(text: string): string | undefined;
    loadVersionFromCommand(command: string): Promise<string | undefined>;
    verifyInstalledApp(versionLoader: () => Promise<string | undefined>, header: string, minVersion: string, recommendationUrl: string): Promise<ReportLine>;
}
export declare class AppVersionVerifyAction implements VerifyAction {
    readonly service: AppVersionService;
    readonly params: {
        header: string;
        version?: string;
        command?: string;
        recommendationUrl: string;
        expectedVersion: string;
    };
    constructor(service: AppVersionService, params: {
        header: string;
        version?: string;
        command?: string;
        recommendationUrl: string;
        expectedVersion: string;
    });
    verify(): Promise<ReportLine>;
    shouldRun(): boolean;
}
export declare class DockerRunVerifyAction implements VerifyAction {
    private readonly logger;
    private readonly runtimeService;
    constructor(logger: Logger, runtimeService: RuntimeService);
    verify(): Promise<ReportLine>;
    shouldRun(lines: ReportLine[]): boolean;
}
export declare class SudoRunVerifyAction implements VerifyAction {
    verify(): Promise<ReportLine>;
    shouldRun(): boolean;
}
export declare class VerifyService {
    private readonly logger;
    private readonly expectedVersions;
    static readonly currentNodeJsVersion: string;
    readonly actions: VerifyAction[];
    private readonly runtimeService;
    constructor(logger: Logger, expectedVersions?: Partial<ExpectedVersions>);
    createReport(): Promise<VerifyReport>;
    logReport(report: VerifyReport): void;
    validateReport(report: VerifyReport): void;
}
