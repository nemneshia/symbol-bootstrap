/**
 * Exception with special, not critical, error handling.
 */
export declare class KnownError extends Error {
    readonly known = true;
}
