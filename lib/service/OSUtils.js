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
exports.OSUtils = void 0;
/**
 * Utility class related to OS differences.
 */
class OSUtils {
    static isRoot() {
        return !OSUtils.isWindows() && (process === null || process === void 0 ? void 0 : process.getuid()) === 0;
    }
    static isWindows() {
        return process.platform === 'win32';
    }
}
exports.OSUtils = OSUtils;
