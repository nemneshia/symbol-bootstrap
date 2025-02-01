"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoUtils = void 0;
/*
 * Copyright 2022 Fernando Boucquez
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const _ = require("lodash");
const symbol_sdk_1 = require("symbol-sdk");
const model_1 = require("../model");
const KnownError_1 = require("./KnownError");
class CryptoUtils {
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static encrypt(value, password, fieldName) {
        if (!value) {
            return value;
        }
        if (_.isArray(value)) {
            return value.map((v) => this.encrypt(v, password));
        }
        if (_.isObject(value)) {
            return _.mapValues(value, (value, name) => CryptoUtils.encrypt(value, password, name));
        }
        if (this.isEncryptableKeyField(value, fieldName)) {
            return CryptoUtils.ENCRYPT_PREFIX + symbol_sdk_1.Crypto.encrypt(value, password);
        }
        return value;
    }
    static getPrivateKeySecurityMode(value) {
        if (!value) {
            return model_1.PrivateKeySecurityMode.ENCRYPT;
        }
        const securityModes = Object.values(model_1.PrivateKeySecurityMode);
        const securityMode = securityModes.find((p) => p.toLowerCase() == value.toLowerCase());
        if (securityMode) {
            return securityMode;
        }
        throw new KnownError_1.KnownError(`${value} is not a valid Security Mode. Please use one of ${securityModes.join(', ')}`);
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static removePrivateKeysAccordingToSecurityMode(value, securityMode) {
        if (securityMode === model_1.PrivateKeySecurityMode.PROMPT_MAIN) {
            return this.removePrivateKeys(value, ['main', 'voting']);
        }
        if (securityMode === model_1.PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT) {
            return this.removePrivateKeys(value, ['main', 'transport', 'voting']);
        }
        if (securityMode === model_1.PrivateKeySecurityMode.PROMPT_ALL) {
            return this.removePrivateKeys(value);
        }
        return this.removePrivateKeys(value, ['voting']);
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static removePrivateKeys(value, blacklistNames = []) {
        if (!value) {
            return value;
        }
        if (_.isArray(value)) {
            return value.map((v) => this.removePrivateKeys(v, blacklistNames));
        }
        if (_.isObject(value)) {
            return _.mapValues(_.pickBy(value, (value, name) => {
                const isBlacklisted = !blacklistNames.length ||
                    blacklistNames.find((blacklistName) => name.toLowerCase().indexOf(blacklistName.toLowerCase()) > -1);
                return !isBlacklisted || !this.isEncryptableKeyField(value, name);
            }), (value, name) => {
                const isBlacklisted = !blacklistNames.length ||
                    blacklistNames.find((blacklistName) => name.toLowerCase().indexOf(blacklistName.toLowerCase()) > -1);
                return CryptoUtils.removePrivateKeys(value, isBlacklisted ? [] : blacklistNames);
            });
        }
        return value;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static decrypt(value, password, fieldName) {
        if (!value) {
            return value;
        }
        if (_.isArray(value)) {
            return value.map((v) => this.decrypt(v, password));
        }
        if (_.isObject(value)) {
            return _.mapValues(value, (value, name) => CryptoUtils.decrypt(value, password, name));
        }
        if (this.isEncryptableKeyField(value, fieldName) && value.startsWith(CryptoUtils.ENCRYPT_PREFIX)) {
            let decryptedValue;
            try {
                const encryptedValue = value.substring(CryptoUtils.ENCRYPT_PREFIX.length);
                decryptedValue = symbol_sdk_1.Crypto.decrypt(encryptedValue, password);
            }
            catch (e) {
                throw Error('Value could not be decrypted!');
            }
            if (!decryptedValue) {
                throw Error('Value could not be decrypted!');
            }
            return decryptedValue;
        }
        return value;
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static encryptedCount(value, fieldName) {
        if (!value) {
            return 0;
        }
        if (_.isArray(value)) {
            return _.sum(value.map((v) => this.encryptedCount(v)));
        }
        if (_.isObject(value)) {
            return _.sum(Object.entries(value).map(([fieldName, value]) => this.encryptedCount(value, fieldName)));
        }
        if (this.isEncryptableKeyField(value, fieldName) && value.startsWith(CryptoUtils.ENCRYPT_PREFIX)) {
            return 1;
        }
        return 0;
    }
    static isEncryptableKeyField(value, fieldName) {
        return (_.isString(value) &&
            fieldName &&
            CryptoUtils.ENCRYPTABLE_KEYS.some((key) => fieldName.toLowerCase().endsWith(key.toLowerCase())));
    }
}
exports.CryptoUtils = CryptoUtils;
CryptoUtils.ENCRYPT_PREFIX = 'ENCRYPTED:';
CryptoUtils.ENCRYPTABLE_KEYS = ['privateKey', 'restSSLKeyBase64', 'privateFileContent'];
