/**
 * Bootstrap constants.
 */
export declare class Constants {
    static readonly defaultTargetFolder = "target";
    static readonly targetNodesFolder = "nodes";
    static readonly targetGatewaysFolder = "gateways";
    static readonly targetExplorersFolder = "explorers";
    static readonly targetDatabasesFolder = "databases";
    static readonly targetNemesisFolder = "nemesis";
    static readonly defaultWorkingDir = ".";
    static readonly CURRENT_USER = "current";
    static readonly VERSION: any;
    /**
     * The folder where this npm module is installed. It defines where the default presets, configurations, etc are located.
     */
    static readonly ROOT_FOLDER: string;
    static resolveRootFolder(): string;
}
