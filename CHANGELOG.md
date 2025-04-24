# CHANGELOG

All notable changes to this project will be documented in this file.

The changelog format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [2.0.6] - 2025-04-24

**Milestone**: Mainnet(1.0.3.8)

| Package          | Version | Link                                                              |
| ---------------- | ------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.6  | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- Fixed `healthCheck` to terminate even while waiting for `Ctrl + C`
- Added support for version checking with the `-v` option

## [2.0.5] - 2025-04-17

**Milestone**: Mainnet(1.0.3.8)

| Package          | Version | Link                                                              |
| ---------------- | ------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.5  | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- Changed node certificates to x509v3.  
  Since it is necessary to recreate them from the CA certificate, you need to delete the `cert` directory and regenerate it.

  ```bash
  rm -rf target/nodes/node/cert
  sb config -c custom-preset.yaml --upgrade
  ```

- Made it possible to disable Metal decoding

  ```yaml
  metal: null
  ```

  Additionally, the method to change the cache size is as follows:

  ```yaml
  metal:
    cacheTtl: 350
    sizeLimit: 15000000
  ```

## [2.0.4] - 2025-04-10

**Milestone**: Mainnet(1.0.3.8)

| Package          | Version | Link                                                              |
| ---------------- | ------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.4  | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- Changed the Explorer Docker image to symbolplatform/symbol-explorer:1.3.0-amd64

## [2.0.3] - 2025-04-09

**Milestone**: Mainnet(1.0.3.8)

| Package          | Version | Link                                                              |
| ---------------- | ------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.3  | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- Added a project name prefix to Docker Compose

## [2.0.2] - 2025-03-06

**Milestone**: Mainnet(1.0.3.8)

| Package          | Version | Link                                                              |
| ---------------- | ------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.2  | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- Fixed missing support for Docker Compose projects when the assembly is Peer

## [2.0.1] - 2025-02-27

**Milestone**: Mainnet(1.0.3.8)

| Package          | Version | Link                                                              |
| ---------------- | ------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.1  | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- [Catapult Client v1.0.3.8](https://github.com/symbol/symbol/releases/tag/client%2Fcatapult%2Fv1.0.3.8)
- [Rest 2.5.0](https://github.com/symbol/symbol/releases/tag/rest%2Fv2.5.0)
- MongoDB 7.0.17
- Support for Docker Compose projects

  ```yaml
  nodes:
    - host: <Host Name>
      friendlyName: <Friendly Name>
      voting: false
      trustedHosts: 127.0.0.1, 172.21.0.25 # Change the network subnet if necessary (for API nodes)
      localNetworks: 127.0.0.1, 172.21.0.25 # Change the network subnet if necessary (for API nodes)

  # REST configuration
  gateways:
    - ipv4_address: 172.21.0.25 # Change the network subnet if necessary

    # Add a prefix to the container name
    dockerComposeProjectName: mainnet
    # Change the network subnet
    subnet: "172.21.0.0/24"
  ```

## [2.0.0] - 2025-02-24

**Milestone**: Mainnet(1.0.3.7)

| Package          | Version | Link                                                              |
| ---------------- | ------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.0  | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- Changed crypto-js to v4.2 (**incompatible with key encryption of the old version**)
- Use docker compose v2
- Changed oclif from v1 to v4
- Converted the entire codebase to ESM accordingly

## [1.1.13] - 2025-02-15

**Milestone**: Mainnet(1.0.3.7)

| Package          | Version | Link                                                              |
| ---------------- | ------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v1.1.13 | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

Update the following packages:

- Fork
- Custom preset allows changing the listening port for Peer

### Explorer Configuration Example

```yaml
explorers:
  - excludeDockerService: false
```

### Example of Changing the Listening Port for Peer

```yaml
nodePort: 7950
apiNodePort: 7950
nodes:
  - openPort: 7950
```

## [1.1.12] - 2025-02-15

**Milestone**: Mainnet(1.0.3.7)

| Package          | Version | Link                                                              |
| ---------------- | ------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v1.1.12 | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

Update the following packages:

- Support for Metal decoding in Rest
- Changed default values for some items in config-node.properties
  - maxChainBytesPerSyncAttempt: 50MB
  - blockDisruptorMaxMemorySize: 1000MB
- Changed default values for some items in config-finalization.properties
  - messageSynchronizationMaxResponseSize: 5MB
