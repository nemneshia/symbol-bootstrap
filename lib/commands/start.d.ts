import { Command } from '@oclif/command';
export default class Start extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        help: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
        target: import("@oclif/command/lib/flags").IOptionFlag<string>;
        password: import("@oclif/command/lib/flags").IOptionFlag<string | undefined>;
        noPassword: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        preset: import("@oclif/command/lib/flags").IOptionFlag<string | undefined>;
        assembly: import("@oclif/command/lib/flags").IOptionFlag<string | undefined>;
        customPreset: import("@oclif/command/lib/flags").IOptionFlag<string | undefined>;
        reset: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        upgrade: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        offline: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        report: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        user: import("@oclif/command/lib/flags").IOptionFlag<string>;
        logger: import("@oclif/command/lib/flags").IOptionFlag<string>;
        detached: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        healthCheck: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        resetData: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        pullImages: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        args: import("@oclif/command/lib/flags").IOptionFlag<string[]>;
        build: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        timeout: import("@oclif/parser/lib/flags").IOptionFlag<number | undefined>;
    };
    run(): Promise<void>;
}
