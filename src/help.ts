import { Help } from '@oclif/core';

import { CommandUtils } from './utils/index.js';

export default class CustomHelp extends Help {
  async showHelp(argv: string[]): Promise<void> {
    CommandUtils.showBanner();
    return super.showHelp(argv);
  }

  //   async showCommandHelp(command: any): Promise<void> {
  //     CommandUtils.showBanner();
  //     return super.showCommandHelp(command);
  //   }
}
