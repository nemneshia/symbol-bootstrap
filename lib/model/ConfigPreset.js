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
exports.SinkType = exports.DebugLevel = exports.TransactionSelectionStrategy = exports.PrivateKeySecurityMode = void 0;
var PrivateKeySecurityMode;
(function (PrivateKeySecurityMode) {
    PrivateKeySecurityMode["ENCRYPT"] = "ENCRYPT";
    PrivateKeySecurityMode["PROMPT_MAIN"] = "PROMPT_MAIN";
    PrivateKeySecurityMode["PROMPT_MAIN_TRANSPORT"] = "PROMPT_MAIN_TRANSPORT";
    PrivateKeySecurityMode["PROMPT_ALL"] = "PROMPT_ALL";
})(PrivateKeySecurityMode = exports.PrivateKeySecurityMode || (exports.PrivateKeySecurityMode = {}));
var TransactionSelectionStrategy;
(function (TransactionSelectionStrategy) {
    TransactionSelectionStrategy["maximizeFee"] = "maximize-fee";
    TransactionSelectionStrategy["oldest"] = "oldest";
    TransactionSelectionStrategy["minimizeFee"] = "minimize-fee";
})(TransactionSelectionStrategy = exports.TransactionSelectionStrategy || (exports.TransactionSelectionStrategy = {}));
var DebugLevel;
(function (DebugLevel) {
    DebugLevel["trace"] = "Trace";
    DebugLevel["debug"] = "Debug";
    DebugLevel["info"] = "Info";
    DebugLevel["important"] = "Important";
    DebugLevel["warning"] = "Warning";
    DebugLevel["error"] = "Error";
    DebugLevel["fatal"] = "Fatal";
    DebugLevel["min"] = "Min";
    DebugLevel["max"] = "Max";
})(DebugLevel = exports.DebugLevel || (exports.DebugLevel = {}));
var SinkType;
(function (SinkType) {
    SinkType["async"] = "Async";
    SinkType["sync"] = "Sync";
})(SinkType = exports.SinkType || (exports.SinkType = {}));
