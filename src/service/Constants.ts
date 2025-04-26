import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(__dirname, '../../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

const version = packageJson.version;

/**
 * Bootstrap constants.
 */
export class Constants {
  public static readonly defaultTargetFolder = 'target';
  public static readonly targetNodesFolder = 'nodes';
  public static readonly targetGatewaysFolder = 'gateways';
  public static readonly targetExplorersFolder = 'explorers';
  public static readonly targetDatabasesFolder = 'databases';
  public static readonly targetNemesisFolder = 'nemesis';

  public static readonly defaultWorkingDir = '.';

  public static readonly CURRENT_USER = 'current';

  public static readonly VERSION = version;

  /**
   * The folder where this npm module is installed. It defines where the default presets, configurations, etc are located.
   */
  public static readonly ROOT_FOLDER = Constants.resolveRootFolder();

  public static resolveRootFolder(): string {
    const rootFolder = resolve(__dirname, '../..');
    if (!existsSync(join(rootFolder, 'presets', 'shared.yml'))) {
      throw new Error(`Root Folder ${rootFolder} does not look right!`);
    }
    return rootFolder;
  }
}
