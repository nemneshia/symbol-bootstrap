export declare type Password = string | false | undefined;
/**
 * Utility methods in charge of loading and saving yaml files (and text files).
 */
export declare class YamlUtils {
    static isYmlFile(string: string): boolean;
    static writeYaml(path: string, object: unknown, password: Password): Promise<void>;
    static toYaml(object: unknown): string;
    static fromYaml(yamlString: string): any;
    static loadYaml(fileLocation: string, password: Password): any;
    static writeTextFile(path: string, text: string): Promise<void>;
    static loadFileAsText(fileLocation: string): string;
    static readTextFile(path: string): Promise<string>;
}
