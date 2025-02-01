import { Command } from '@oclif/command';
export default class HealthCheck extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        help: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
        target: import("@oclif/command/lib/flags").IOptionFlag<string>;
        logger: import("@oclif/command/lib/flags").IOptionFlag<string>;
    };
    run(): Promise<void>;
}
