import { Command } from '@oclif/core';

export default class Version extends Command {
  static description = 'Show bootstrap version';
  static aliases = ['-v'];

  async run() {
    this.log(this.config.userAgent);
  }
}
