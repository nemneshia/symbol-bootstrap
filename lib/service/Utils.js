"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Utils = void 0;
const _ = require("lodash");
const path_1 = require("path");
const symbol_sdk_1 = require("symbol-sdk");
const KnownError_1 = require("./KnownError");
const OSUtils_1 = require("./OSUtils");
/**
 * Random utility methods that don't fit other place.
 */
class Utils {
    static secureString(text) {
        const regex = new RegExp('[0-9a-fA-F]{64}', 'g');
        return text.replace(regex, 'HIDDEN_KEY');
    }
    static validateIsDefined(value, message) {
        if (value === undefined || value === null) {
            throw new Error(message);
        }
    }
    static validateIsTrue(value, message) {
        if (!value) {
            throw new Error(message);
        }
    }
    static logSameLineMessage(message) {
        process.stdout.write(OSUtils_1.OSUtils.isWindows() ? '\x1b[0G' : '\r');
        process.stdout.write(message);
    }
    static validatePassword(password) {
        const passwordMinSize = 4;
        if (password.length < passwordMinSize) {
            throw new KnownError_1.KnownError(`Password is too short. It should have at least ${passwordMinSize} characters!`);
        }
        return password;
    }
    static getNetworkIdentifier(networkType) {
        return Utils.getNetworkName(networkType);
    }
    static getNetworkName(networkType) {
        switch (networkType) {
            case symbol_sdk_1.NetworkType.MAIN_NET:
                return 'mainnet';
            case symbol_sdk_1.NetworkType.TEST_NET:
                return 'testnet';
        }
        throw new Error(`Invalid Network Type ${networkType}`);
    }
    static resolveWorkingDirPath(workingDir, path) {
        if ((0, path_1.isAbsolute)(path)) {
            return path;
        }
        else {
            return (0, path_1.join)(workingDir, path);
        }
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static pruneEmpty(obj) {
        return (function prune(current) {
            _.forOwn(current, (value, key) => {
                if (_.isUndefined(value) || _.isNull(value) || _.isNaN(value) || (_.isObject(value) && _.isEmpty(prune(value)))) {
                    delete current[key];
                }
            });
            // remove any leftover undefined values from the delete
            // operation on an array
            if (_.isArray(current))
                _.pull(current, undefined);
            return current;
        })(_.cloneDeep(obj)); // Do not modify the original object, create a clone instead
    }
    static getMessage(e) {
        return e['message'] || `${e}`;
    }
}
exports.Utils = Utils;
