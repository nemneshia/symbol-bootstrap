import { Command, flags } from '@oclif/command';
export default class Encrypt extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        help: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
        source: flags.IOptionFlag<string>;
        destination: flags.IOptionFlag<string>;
        password: flags.IOptionFlag<string | undefined>;
        logger: flags.IOptionFlag<string>;
    };
    run(): Promise<void>;
}
