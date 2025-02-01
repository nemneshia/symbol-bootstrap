export interface Logger {
    error: LeveledLogMethod;
    warn: LeveledLogMethod;
    info: LeveledLogMethod;
    debug: LeveledLogMethod;
}
interface LeveledLogMethod {
    (message: string, ...meta: any[]): Logger;
    (message: any): Logger;
}
export {};
