# CHANGELOG

All notable changes to this project will be documented in this file.

The changelog format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.1.11] - Apr-6-2024

**Milestone**: Mainnet(1.0.3.7)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.1.11 | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

Update the following packages:

- [Catapult Client v1.0.3.7](https://github.com/symbol/symbol/releases/tag/client%2Fcatapult%2Fv1.0.3.7)
- [Rest 2.4.3](https://github.com/symbol/symbol/releases/tag/rest%2Fv2.4.4)
- MongoDB 6.0.14
- https-portal 1.23.1

## [1.1.10] - Apr-14-2023

**Milestone**: Mainnet(1.0.3.6)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.1.10 | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

Update the following packages:

- [Catapult Client v1.0.3.6](https://github.com/symbol/symbol/releases/tag/client%2Fcatapult%2Fv1.0.3.6)
- [Rest 2.4.3](https://github.com/symbol/symbol/releases/tag/rest%2Fv2.4.3)
- MongoDB 5.0.15
- https-portal 1.23.0
- update uncirculating account public keys
- add new indexes to MongoDB
  - transaction.mosaics.id
  - statement.receipts.targetAddress
  - statement.receipts.senderAddress

## [1.1.9] - Nov-09-2022

**Milestone**: Mainnet(1.0.3.5)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.1.9  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Testnet reset(sainet).
- Update to [Catapult Client v1.0.3.5](https://github.com/symbol/symbol/releases/tag/client%2Fcatapult%2Fv1.0.3.5)

## [1.1.8] - Oct-25-2022

**Milestone**: Mainnet(1.0.3.4)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.1.8  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- (BREAKING FORK) catapult client register aggregate transaction hash validator and require aggregate version 2 after fork

## [1.1.6] - Mar-16-2022

**Milestone**: Mainnet(1.0.3.3)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.1.6  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Fixed openssl security vulnerability [issue](https://www.opencve.io/cve/CVE-2022-0778)

## [1.1.5] - Mar-1-2022

**Milestone**: Mainnet(1.0.3.1)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.1.5  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Fixed undefined error circular dependency when using PROMPT_MAIN. Issue #378.

## [1.1.4] - Feb-4-2022

**Milestone**: Mainnet(1.0.3.1)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.1.4  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- `BootstrapUtils` code clean up split.
- Allowing user provided compose services via custom preset.
- Added `services` assembly.
- Lib upgrades.

## [1.1.3] - Jan-21-2022

**Milestone**: Mainnet(1.0.3.1)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.1.3  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Added `--force` to `renewCertificates`.
- Fixed `renewCertificates` when renewing certificates created using an old Bootstrap version.

## [1.1.2] - Jan-17-2022

**Milestone**: Mainnet(1.0.3.1)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.1.2  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Joeynet Testnet Release.
- Added Node SSL Certificate check and upgrade. Added `renewCertificates` command to renew the certificates.
- The `bootstrap` preset is not the default anymore. The name must be provided via `--preset` or as a custom preset field.
- A 'safe' custom preset is cached in the target folder. It's not required when upgrading the node without a configuration change.
- Added `--logger` option to the commands.
- Assemblies are shared between all the presets.
- Allowing user provided `--preset` and `--assembly` yml files.
- Removed wallet from `demo` preset.
- CI migrated from Travis to GitHub Actions.
- Fixed Faucet and Explorer versions. Full upgrade requires adding statistic service to `demo` preset.

## [1.1.1] - Nov-16-2021

**Milestone**: Mainnet(1.0.3.1)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.1.1  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Fixed `symbol-statistics-service-typescript-fetch-client` exception handling.
- Rest `2.4.0` upgrade.
- Fixed peer and api json file generation.
- Changed `maxTimeBehindPullTransactionsStart` to 5m.

## [1.1.0] - Nov-05-2021

**Milestone**: Mainnet(1.0.3.0)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.1.0  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Added `wizard` command.
- Added `pack` command.
- Added `modifyMultisig` command.
- Added `--serviceProviderPublicKey` to `link` command.
- Rest `2.3.8` upgrade.
- Explorer `1.1.0` upgrade.
- Faucet `1.0.1` upgrade.
- Removed node reward support.
- Removed unused `sshpk` service and dependency.
- Removed unused `forge` service and dependency.
- Changed `stop` command to run `docker-compose stop` instead of `docker-compose down`
- Added statistic service integration.
- Removed node static list from `mainnet` and `testnet` preset. The node lists are resolved using the statistic service.
- Updated explorer and faucet urls.
- Removed private and mijin network types support.

## [1.0.9] - Sep-15-2021

**Milestone**: Mainnet(1.0.2.0)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.0.9  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Hot fix `updateVotingKeys` command bug.

## [1.0.8] - Sep-14-2021

**Milestone**: Mainnet(1.0.2.0)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.0.8  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Fixed `updateVotingKeys` command when upgrading from `1.0.6`.
- Catapult `1.0.2.0` upgrade.
- Updated `minPartnerNodeVersion` to `1.0.1.0`. Older Catapult clients will be rejected.

## [1.0.7] - June-22-2021

**Milestone**: Mainnet(1.0.1.0)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.0.7  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Added multi voting key file support.
- Added `updateVotingKeys` command.

## [1.0.6] - June-8-2021

**Milestone**: Mainnet(1.0.1.0)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.0.6  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Catapult Server `1.0.1.0` upgrade.
- Symbol Rest `2.3.6` upgrade.
- Reward Program Agent `2.0.0` upgrade.
- Added `MonitorOnly` reward program.
- The `link` and `enrollRewardProgram` commands allow `--customPreset` to avoid password prompt when main private key is not stored in the target folder.
- Merged tools and server docker images into one.

## [1.0.5] - May-3-2021

**Milestone**: Mainnet(1.0.0.0)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.0.5  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Re-enabled node reward program. Upgraded TLS communication.
- Fixed `failed to load: /docker-entrypoint-initdb.d/mongoDbPrepare.js` when running with root user.
- Renamed `enrol` to `enroll` for the Rewards Program.

## [1.0.4] - Apr-13-2021

**Milestone**: Mainnet(1.0.0.0)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.0.4  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- New `testnet.symboldev.network` testnet!
- Added `verify` command.
- Fixed host override when no custom preset is provided in mainnet.
- Fixed case issue validating keys when creating certificates.
- Updated Wallet to latest 1.0.1 release.
- Node properties sinkType: Async and enableSingleThreadPool: false by default in peer nodes too.
- Dropped NodeJS 10 support. Added Node LTS and Stable Support.

## [1.0.3] - Mar-31-2021

**Milestone**: Mainnet(1.0.0.0)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.0.3  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Improved Custom Preset Object types for symbol bootstrap lib integration.
- TransactionSelectionStrategy's new default value is `oldest`.

## [1.0.2] - Mar-24-2021

**Milestone**: Mainnet(1.0.0.0)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.0.2  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Fixed link (--unlink) command when voting properties changes.
- Broker ports (7902) are closed by default in compose.
- Peer role is selected based on `syncsource` configuration and not on the `harvesting` flag.

## [1.0.1] - Mar-22-2021

**Milestone**: Mainnet(1.0.0.0)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.0.1  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Random and limited peer/api list.
- Custom `votingUnfinalizedBlocksDuration` and `nonVotingUnfinalizedBlocksDuration` preset properties.
- Agent service is disabled until supernode program resumes.
- The default `beneficiaryAddress` is the node's main address. Use `beneficiaryAddress: ''` in a custom preset to override the new default.

## [1.0.0] - Mar-16-2021

**Milestone**: Mainnet(1.0.0.0)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v1.0.0  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- **New `mainnet` preset!!!**
- Removed node from its own `peers-p2p.json` and `peers-api.json` files.
- Voting keys are ephemeral. They cannot be provided, bootstrap will always generate a new one when resetting the configuration. Bootstrap will never store the voting private key in addresses.yml.
- Dropped `PROMPT_MAIN_VOTING` from `privateKeySecurityMode`.
- Added `PROMPT_MAIN_TRANSPORT` to `privateKeySecurityMode`: The transport/node key will be asked when regenerating the certificates or when upgrading a supernode.
- Changed server file permission to 0o600

## [0.4.5] - Mar-5-2021

**Milestone**: Hippopotamus(0.10.0.8)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.4.5  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Added `privateKeySecurityMode`. It defines which private keys can be encrypted and stored in the `target/addresses.yml`:
  - `ENCRYPT`: All private keys are encrypted and stored in the target's `addresses.yml` file. Bootstrap will require a password to operate.
  - `PROMPT_MAIN`: Main private keys are not stored in the target's `addresses.yml` file. Bootstrap will request the main private key when certificates are generated, or transactions need to be signed by the `link` and `enrolProgram` commands.
  - `PROMPT_MAIN_VOTING`: Main and voting private keys are not stored in the target's `addresses.yml` file. Bootstrap will request the main private key when certificates are generated, or transactions need to be signed by the `link` and `enrolProgram` commands. The voting private key will be requested when generating the voting key file.
  - `PROMPT_ALL`: No private keys are stored in the in the target's `addresses.yml` file. Bootstrap will request the private keys when they are required by the different commands.
- The `preset.yml` doesn't contain any private key anymore, encrypted or otherwise.
- Certificates are not re-generated if not needed when running `--upgrade`. In this case, the main account private key is not required and will not be requested with the `PROMPT` security modes.
- Voting key files are not re-generated if not needed when running `--upgrade`. In this case, the voting account private key is not required and will not be requested with the `PROMPT_ALL` or `PROMPT_MAIN_VOTING` security modes.
- Public keys can be used in custom presets in addition to encrypted private keys. If public keys are used, Bootstrap will prompt for the private keys when required.
- Added `encrypt` and `decrypt` commands to encrypt custom presets and decrypt generated `target/addresses.yml` files:
- The `--upgrade` param can be used to change the server keys without dropping the data.
- Splitting `userconfig` into `server-config` and `broker-config` for each service.
- Fixed recovery process.

## [0.4.4] - Feb-24-2021

**Milestone**: Hippopotamus(0.10.0.7)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.4.4  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Added `--ready` to `link` and `enrolRewardProgram` commands.
- Fixed how seed is copied to node folders when `--upgrade` and `resetData` are used
- Moved Reward Program Agent to its own service/container in docker-compose.yml.

## [0.4.3] - Feb-15-2021

**Milestone**: Hippopotamus(0.10.0.7)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.4.3  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Added Core Dump files when `dockerComposeDebugMode: true`.
- Added autocomplete support. Try `symbol-bootstrap autocomplete` and follow the instructions (Thanks @44uk).
- Renamed `supernode` keywords for `rewardProgram` for clarification. Supernode is a type of Reward Program.
- Voting is not required to enrol a program.
- Renamed command from `enrolSupernode` for `enrolRewardProgram`.
- Added preset configurable `connectionPoolSize` to the Rest Gateway configuration.
- Removed Node Key Link transactions from nemesis and `link` command.

## [0.4.2] - Feb-2-2021

**Milestone**: Hippopotamus(0.10.0.6)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.4.2  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Link command supports for `main` multisig accounts.
- Supernode enrol command supports for `main` multisig accounts.
- Storing downloaded artifacts (like agent binary) in the current working dir fixing issue when installing bootstrap as root.
- Moved voting keys files from ./data to ./userconfig in the target folder.
- Added Symbol Bootstrap version to generated configuration reports.
- Renamed command from `supernode` for `enrolSupernode`.

## [0.4.1] - Jan-19-2021

**Milestone**: Hippopotamus(0.10.0.5)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.4.1  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Improved --password. It's only required when private keys need to be read.
- Added `database` service to server and broker `depends_on` compose services.
- Fixed `link --unlink` command for Voting Key Link transactions.
- Added multisig account validation to `link` and `supernode` commands.
- Added `CONTROLLER_PUBLIC_KEY` to Supernode's agent configuration
- Upgraded Symbol Rest to version 2.3.1.

## [0.4.0] - Jan-14-2021

**Milestone**: Hippopotamus(0.10.0.5)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.4.0  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- **Re track to catapult-server main branch**
- Compose file version default to 2.4.
- Fixed mongo memory usage by adding `--wiredTigerCacheSizeGB` limit.
- Allowing users to exclude custom preset data from a compose service.
- Basic implementation of supernode program monitoring agent. Supernode Agent installation and supernode enrol command, disabled at present, awaiting full programme implementation, preparatory step.
- Private key in generated addresses.yml and preset.yml can be encrypted and protected by using --password.
- Masking 64 hex keys HIDDEN_KEY on log lines.
- Removed unused Server configuration files in the Rest container. This reduces the risk of exposing config files if the Rest machine gets compromised.

## [0.3.1] - Dec-17-2020

**Milestone**: Hippopotamus(0.10.0.4)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.3.1  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Allowed Bootstrap to run as sudo/root. NOT RECOMMENDED!
- Added Chmod 777 permission change to the db data folder when running as sudo/root.
- Increased Rest's DB connection attempts and retries. This avoids Rest shutting down if the DB creation takes longer.
- Updated Wallet to latest 0.13.6 release

## [0.3.0] - Dec-15-2020

**Milestone**: Hippopotamus(0.10.0.4)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.3.0  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- **New Service:** `Wallet`. Bootstrap private network starts a Wallet service in [http://localhost:80/](http://localhost:80/) when using `--assembly full`. . **Warning:** This wallet service is for demonstration purposes only.
- **New Service:** `Explorer`. Bootstrap private network starts an Explorer service in [http://localhost:90/](http://localhost:90/) when using `--assembly full`.
- **New Service:** `Faucet`. Bootstrap private network starts a Faucet service in [http://localhost:100/](http://localhost:100/) when using `--assembly full`.
- Using remote accounts when setting up nodes by default. This improves security by avoiding main account private keys to be exposed in node configuration (like `harvesterSigningPrivateKey`).
- Removed unnecessary tls related files once certificates are created.
- Added addresses.yml migration from old formats.
- Added --upgrade flag to config, compose and start.
- Fixed api broker name in testnet's api assembly.
- Images are not pulled by default speeding up bootstrap and avoiding unexpected alpha server upgrades. To pull new images use `--pullImages`.
- Testnet Long Voting Key V1 and Short Voting Key V2 support.
- Added `compose` preset support to inject properties into generated docker-compose services.

## [0.2.1] - 30-Oct-2020

**Milestone**: Hippopotamus(0.10.0.3)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.2.1  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Fixed DB initialization.
- Added more configurable properties.

## [0.2.0] - 21-Oct-2020

**Milestone**: Hippopotamus(0.10.0.3)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.2.0  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- **[BREAKING CHANGE]** Target folder structure has been changed for scalability. The old target folder needs to be dropped when running this version. Backup the target folder if you need to keep your data!
- **New Command:** `symbol-bootstrap resetData` cleans the peer data and database without dropping the generated configuration.
- **New Command:** `symbol-bootstrap healthCheck` tests if the docker compose network is running locally. `--healthCheck` param is allowed in `start` and `run` commands.
- Allowed `repeat` on a node, a database or a gateway to instantiate them multiple times. This enables you to create large network configurations quickly.
- Allowed `repeat` in the nemesis block's mosaic list. Harvest currency can be removed with `repeat:0`.
- Removed preset `light`. Now it's an assembly for the bootstrap preset: `symbol-bootstrap -p bootstrap -a light`.
- Sink addresses are generated by default.
- Path properties are now relative folder locations. This improves reusability of the configuration when running the services outside docker compose.
- Added node type based default configuration simplifying the configuration of nodes in presets.
- Preset attribute `excludeDockerService: true` allows removing a service from docker-compose.
- Configurable `trustedHosts` and `localNetworks` in config.
- Simplified mounted volumes in compose.
- Allowed multiple databases in compose.
- Compose's `openPort` now accepts port number.
- Allowed custom ip address and subnet configuration in compose.
- Merged `db` and `db-init` services in compose. Now the mongo service knows how to init itself.

## [0.1.1] - 02-Oct-2020

**Milestone**: Hippopotamus(0.10.0.3)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.1.1  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- **New Command:** `symbol-bootstrap link` links the nodes' VRF and Voting keys to an existing network. This simplifies the node registration process to running networks like `testnet`.
- **New Command:** `symbol-bootstrap report` generates rst and csv files from the configured server properties for documentation. Added `--report` flag to `config` and `start` commands.
- Fixed default host names in `api` and `peer` in `testnet` preset.
- The `voting:`, `harvesting:` and `api:` node preset flags define the node's `roles:` setting. There is no need to provide `roles:` attribute anymore.
- Voting, signing and VRF keys, transactions and tree file are generated and announced when required depending on the node role flags.
- Added `votingKeyDilution`, `votingKeyStartEpoch` `votingKeyEndEpoch` preset params define to voting key link transaction and tree file.
- The field `enableDispatcherInputAuditing` is disabled by default saving disk space.
- Added custom host configuration in docker-compose.
- Readme and custom preset examples have been improved.
- Allowing API custom preset object in addition to the file custom yml file.

## [0.1.0] - 26-Sep-2020

**Milestone**: Hippopotamus(0.10.0.3)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.1.0  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- 0.10.0.3 catapult server support.
- 2.1.0 rest server support.
- Improved logging configuration.
- Allowing custom user when running config time docker images.
- Renamed param from `--daemon` to `--detached` to keep it in line with docker compose.
- Added `--service (-s)` to allow starting just one docker service by name.

## [0.0.0] - 14-Sep-2020

**Milestone**: Gorilla.1(0.9.6.4)

| Package          | Version | Link                                                               |
| ---------------- | ------- | ------------------------------------------------------------------ |
| Symbol Bootstrap | v0.0.0  | [symbol-bootstrap](https://www.npmjs.com/package/symbol-bootstrap) |

- Very first version of the tool!
