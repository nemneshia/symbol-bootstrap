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
exports.HandlebarsUtils = void 0;
const fs_1 = require("fs");
const Handlebars = require("handlebars");
const _ = require("lodash");
const os_1 = require("os");
const path_1 = require("path");
const symbol_sdk_1 = require("symbol-sdk");
const Utils_1 = require("./Utils");
const YamlUtils_1 = require("./YamlUtils");
class HandlebarsUtils {
    static async generateConfiguration(
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    templateContext, copyFrom, copyTo, excludeFiles = [], includeFiles = []) {
        // Loop through all the files in the config folder
        await fs_1.promises.mkdir(copyTo, { recursive: true });
        const files = await fs_1.promises.readdir(copyFrom);
        await Promise.all(files.map(async (file) => {
            const fromPath = (0, path_1.join)(copyFrom, file);
            const toPath = (0, path_1.join)(copyTo, file);
            // Stat the file to see if we have a file or dir
            const stat = await fs_1.promises.stat(fromPath);
            if (stat.isFile()) {
                const isMustache = file.indexOf('.mustache') > -1;
                const destinationFile = toPath.replace('.mustache', '');
                const fileName = (0, path_1.basename)(destinationFile);
                const notBlacklisted = excludeFiles.indexOf(fileName) === -1;
                const inWhitelistIfAny = includeFiles.length === 0 || includeFiles.indexOf(fileName) > -1;
                if (notBlacklisted && inWhitelistIfAny) {
                    if (isMustache) {
                        const template = await YamlUtils_1.YamlUtils.readTextFile(fromPath);
                        const renderedTemplate = this.runTemplate(template, templateContext);
                        await fs_1.promises.writeFile(destinationFile, destinationFile.toLowerCase().endsWith('.json')
                            ? HandlebarsUtils.formatJson(renderedTemplate)
                            : renderedTemplate);
                    }
                    else {
                        await fs_1.promises.copyFile(fromPath, destinationFile);
                    }
                    await fs_1.promises.chmod(destinationFile, 0o600);
                }
            }
            else if (stat.isDirectory()) {
                await fs_1.promises.mkdir(toPath, { recursive: true });
                await this.generateConfiguration(templateContext, fromPath, toPath, excludeFiles, includeFiles);
            }
        }));
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static runTemplate(template, templateContext) {
        try {
            const compiledTemplate = Handlebars.compile(template);
            return compiledTemplate(templateContext);
        }
        catch (e) {
            const securedTemplate = Utils_1.Utils.secureString(template);
            const securedContext = Utils_1.Utils.secureString(YamlUtils_1.YamlUtils.toYaml(templateContext));
            const securedMessage = Utils_1.Utils.secureString(Utils_1.Utils.getMessage(e));
            const message = `Unknown error rendering template. Error: ${securedMessage}\nTemplate:\n${securedTemplate}.`;
            throw new Error(`${message}\nContext: \n${securedContext}`);
        }
    }
    static add(a, b) {
        if (_.isNumber(a) && _.isNumber(b)) {
            return Number(a) + Number(b);
        }
        if (typeof a === 'string' && typeof b === 'string') {
            return a + b;
        }
        return '';
    }
    static minus(a, b) {
        if (!_.isNumber(a)) {
            throw new TypeError('expected the first argument to be a number');
        }
        if (!_.isNumber(b)) {
            throw new TypeError('expected the second argument to be a number');
        }
        return Number(a) - Number(b);
    }
    static computerMemory(percentage) {
        return ((0, os_1.totalmem)() * percentage) / 100;
    }
    static toAmount(renderedText) {
        const numberAsString = (renderedText + '').split("'").join('');
        if (!numberAsString.match(/^\d+$/)) {
            throw new Error(`'${renderedText}' is not a valid integer`);
        }
        return (numberAsString.match(/\d{1,3}(?=(\d{3})*$)/g) || [numberAsString]).join("'");
    }
    static toHex(renderedText) {
        if (!renderedText) {
            return '';
        }
        const numberAsString = HandlebarsUtils.toSimpleHex(renderedText);
        return '0x' + (numberAsString.match(/\w{1,4}(?=(\w{4})*$)/g) || [numberAsString]).join("'");
    }
    static toSimpleHex(renderedText) {
        if (!renderedText) {
            return '';
        }
        return renderedText.toString().split("'").join('').replace(/^(0x)/, '');
    }
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    static toJson(object) {
        return JSON.stringify(object, null, 2);
    }
    static formatJson(string) {
        // Validates and format the json string.
        try {
            return JSON.stringify(JSON.parse(string), null, 2);
        }
        catch (e) {
            throw new Error(`${Utils_1.Utils.getMessage(e)}:JSON\n ${string}`);
        }
    }
    static splitCsv(object) {
        return (object || '')
            .split(',')
            .map((string) => string.trim())
            .filter((string) => string);
    }
    static toSeconds(serverDuration) {
        return symbol_sdk_1.DtoMapping.parseServerDuration(serverDuration).seconds();
    }
}
exports.HandlebarsUtils = HandlebarsUtils;
//HANDLEBARS READY FUNCTIONS:
HandlebarsUtils.initialize = (() => {
    Handlebars.registerHelper('toAmount', HandlebarsUtils.toAmount);
    Handlebars.registerHelper('toHex', HandlebarsUtils.toHex);
    Handlebars.registerHelper('toSimpleHex', HandlebarsUtils.toSimpleHex);
    Handlebars.registerHelper('toSeconds', HandlebarsUtils.toSeconds);
    Handlebars.registerHelper('toJson', HandlebarsUtils.toJson);
    Handlebars.registerHelper('splitCsv', HandlebarsUtils.splitCsv);
    Handlebars.registerHelper('add', HandlebarsUtils.add);
    Handlebars.registerHelper('minus', HandlebarsUtils.minus);
    Handlebars.registerHelper('computerMemory', HandlebarsUtils.computerMemory);
})();
