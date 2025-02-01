"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationUtils = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const symbol_sdk_1 = require("symbol-sdk");
const Constants_1 = require("./Constants");
const YamlUtils_1 = require("./YamlUtils");
/**
 * Utility class for bootstrap configuration related methods.
 */
class ConfigurationUtils {
    static toConfigAccountFomKeys(networkType, publicKey, privateKey) {
        const account = this.toAccount(networkType, publicKey, privateKey);
        if (!account) {
            return undefined;
        }
        return this.toConfigAccount(account);
    }
    static toAccount(networkType, publicKey, privateKey) {
        if (privateKey) {
            const account = symbol_sdk_1.Account.createFromPrivateKey(privateKey, networkType);
            if (publicKey && account.publicKey.toUpperCase() != publicKey.toUpperCase()) {
                throw new Error('Invalid provided public key/private key!');
            }
            return account;
        }
        if (publicKey) {
            return symbol_sdk_1.PublicAccount.createFromPublicKey(publicKey, networkType);
        }
        return undefined;
    }
    static toConfigAccount(account) {
        // isntanceof doesn't work when loaded in multiple libraries.
        //https://stackoverflow.com/questions/59265098/instanceof-not-work-correctly-in-typescript-library-project
        if (account.constructor.name === symbol_sdk_1.Account.name) {
            return {
                privateKey: account.privateKey,
                publicKey: account.publicKey,
                address: account.address.plain(),
            };
        }
        return {
            publicKey: account.publicKey,
            address: account.address.plain(),
        };
    }
    static resolveRoles(nodePreset) {
        if (nodePreset.roles) {
            return nodePreset.roles;
        }
        const roles = [];
        if (nodePreset.syncsource) {
            roles.push('Peer');
        }
        if (nodePreset.api) {
            roles.push('Api');
        }
        if (nodePreset.voting) {
            roles.push('Voting');
        }
        return roles.join(',');
    }
    static shouldCreateNemesis(presetData) {
        return (presetData.nemesis &&
            !presetData.nemesisSeedFolder &&
            (YamlUtils_1.YamlUtils.isYmlFile(presetData.preset) || !(0, fs_1.existsSync)((0, path_1.join)(Constants_1.Constants.ROOT_FOLDER, 'presets', presetData.preset, 'seed'))));
    }
}
exports.ConfigurationUtils = ConfigurationUtils;
