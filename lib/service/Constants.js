"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Constants = void 0;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs_1 = require("fs");
const path_1 = require("path");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const version = require('../../package.json').version;
/**
 * Bootstrap constants.
 */
class Constants {
    static resolveRootFolder() {
        const rootFolder = (0, path_1.resolve)(__dirname, '../..');
        if (!(0, fs_1.existsSync)((0, path_1.join)(rootFolder, 'presets', 'shared.yml'))) {
            throw new Error(`Root Folder ${rootFolder} does not look right!`);
        }
        return rootFolder;
    }
}
exports.Constants = Constants;
Constants.defaultTargetFolder = 'target';
Constants.targetNodesFolder = 'nodes';
Constants.targetGatewaysFolder = 'gateways';
Constants.targetExplorersFolder = 'explorers';
Constants.targetDatabasesFolder = 'databases';
Constants.targetNemesisFolder = 'nemesis';
Constants.defaultWorkingDir = '.';
Constants.CURRENT_USER = 'current';
Constants.VERSION = version;
/**
 * The folder where this npm module is installed. It defines where the default presets, configurations, etc are located.
 */
Constants.ROOT_FOLDER = Constants.resolveRootFolder();
