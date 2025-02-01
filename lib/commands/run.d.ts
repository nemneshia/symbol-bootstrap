import { Command, flags } from '@oclif/command';
export default class Run extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        help: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
        target: flags.IOptionFlag<string>;
        detached: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        healthCheck: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        resetData: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        pullImages: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        args: flags.IOptionFlag<string[]>;
        build: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        timeout: import("@oclif/parser/lib/flags").IOptionFlag<number | undefined>;
        logger: flags.IOptionFlag<string>;
    };
    run(): Promise<void>;
}
