import { Command, flags } from '@oclif/command';
export default class Link extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        logger: flags.IOptionFlag<string>;
        password: flags.IOptionFlag<string | undefined>;
        noPassword: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        url: flags.IOptionFlag<string>;
        useKnownRestGateways: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        ready: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        maxFee: import("@oclif/parser/lib/flags").IOptionFlag<number | undefined>;
        customPreset: flags.IOptionFlag<string | undefined>;
        serviceProviderPublicKey: flags.IOptionFlag<string | undefined>;
        help: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
        target: flags.IOptionFlag<string>;
        unlink: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
    };
    run(): Promise<void>;
}
