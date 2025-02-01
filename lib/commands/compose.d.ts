import { Command, flags } from '@oclif/command';
export default class Compose extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        help: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
        target: flags.IOptionFlag<string>;
        password: flags.IOptionFlag<string | undefined>;
        noPassword: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        upgrade: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        offline: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        user: flags.IOptionFlag<string>;
        logger: flags.IOptionFlag<string>;
    };
    run(): Promise<void>;
}
