export declare class HandlebarsUtils {
    static generateConfiguration(templateContext: any, copyFrom: string, copyTo: string, excludeFiles?: string[], includeFiles?: string[]): Promise<void>;
    static runTemplate(template: string, templateContext: any): string;
    private static initialize;
    private static add;
    private static minus;
    static computerMemory(percentage: number): number;
    static toAmount(renderedText: string | number): string;
    static toHex(renderedText: string): string;
    static toSimpleHex(renderedText: string): string;
    static toJson(object: any): string;
    static formatJson(string: string): string;
    static splitCsv(object: string): string[];
    static toSeconds(serverDuration: string): number;
}
