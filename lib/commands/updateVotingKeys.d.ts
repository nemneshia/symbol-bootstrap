import { Command, flags } from '@oclif/command';
export default class UpdateVotingKeys extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        help: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
        target: flags.IOptionFlag<string>;
        user: flags.IOptionFlag<string>;
        finalizationEpoch: import("@oclif/parser/lib/flags").IOptionFlag<number | undefined>;
        logger: flags.IOptionFlag<string>;
    };
    run(): Promise<void>;
}
