import { Command, flags } from '@oclif/command';
export default class Pack extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        ready: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        logger: flags.IOptionFlag<string>;
        help: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
        target: flags.IOptionFlag<string>;
        password: flags.IOptionFlag<string | undefined>;
        noPassword: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        preset: flags.IOptionFlag<string | undefined>;
        assembly: flags.IOptionFlag<string | undefined>;
        customPreset: flags.IOptionFlag<string | undefined>;
        reset: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        upgrade: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        offline: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        report: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        user: flags.IOptionFlag<string>;
    };
    run(): Promise<void>;
}
