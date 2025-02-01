import { Command } from '@oclif/command';
export default class Verify extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        help: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
        logger: import("@oclif/command/lib/flags").IOptionFlag<string>;
    };
    run(): Promise<void>;
}
