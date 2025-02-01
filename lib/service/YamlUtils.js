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
exports.YamlUtils = void 0;
const fs_1 = require("fs");
const yaml = require("js-yaml");
const path_1 = require("path");
const CryptoUtils_1 = require("./CryptoUtils");
const KnownError_1 = require("./KnownError");
const Utils_1 = require("./Utils");
/**
 * Utility methods in charge of loading and saving yaml files (and text files).
 */
class YamlUtils {
    static isYmlFile(string) {
        return string.toLowerCase().endsWith('.yml') || string.toLowerCase().endsWith('.yaml');
    }
    static async writeYaml(path, object, password) {
        const yamlString = this.toYaml(password ? CryptoUtils_1.CryptoUtils.encrypt(object, Utils_1.Utils.validatePassword(password)) : object);
        await this.writeTextFile(path, yamlString);
    }
    static toYaml(object) {
        return yaml.dump(object, { skipInvalid: true, indent: 4, lineWidth: 140, noRefs: true });
    }
    static fromYaml(yamlString) {
        return yaml.load(yamlString);
    }
    static loadYaml(fileLocation, password) {
        const object = this.fromYaml(this.loadFileAsText(fileLocation));
        if (password) {
            Utils_1.Utils.validatePassword(password);
            try {
                return CryptoUtils_1.CryptoUtils.decrypt(object, password);
            }
            catch (e) {
                throw new KnownError_1.KnownError(`Cannot decrypt file ${fileLocation}. Have you used the right password?`);
            }
        }
        else {
            if (password !== false && CryptoUtils_1.CryptoUtils.encryptedCount(object) > 0) {
                throw new KnownError_1.KnownError(`File ${fileLocation} seems to be encrypted but no password has been provided. Have you entered the right password?`);
            }
        }
        return object;
    }
    static async writeTextFile(path, text) {
        const mkdirParentFolder = async (fileName) => {
            const parentFolder = (0, path_1.dirname)(fileName);
            if (parentFolder) {
                await fs_1.promises.mkdir(parentFolder, { recursive: true });
            }
        };
        await mkdirParentFolder(path);
        await fs_1.promises.writeFile(path, text, 'utf8');
    }
    static loadFileAsText(fileLocation) {
        return (0, fs_1.readFileSync)(fileLocation, 'utf8');
    }
    static async readTextFile(path) {
        return fs_1.promises.readFile(path, 'utf8');
    }
}
exports.YamlUtils = YamlUtils;
