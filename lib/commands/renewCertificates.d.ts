import { Command, flags } from '@oclif/command';
export default class RenewCertificates extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        help: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
        target: flags.IOptionFlag<string>;
        password: flags.IOptionFlag<string | undefined>;
        noPassword: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        customPreset: flags.IOptionFlag<string | undefined>;
        user: flags.IOptionFlag<string>;
        force: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        logger: flags.IOptionFlag<string>;
    };
    run(): Promise<void>;
}
