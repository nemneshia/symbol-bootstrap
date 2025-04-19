`symbol-bootstrap pack`
=======================

It configures and packages your node into a zip file that can be uploaded to the final node machine.

* [`symbol-bootstrap pack`](#symbol-bootstrap-pack)

## `symbol-bootstrap pack`

It configures and packages your node into a zip file that can be uploaded to the final node machine.

```
USAGE
  $ symbol-bootstrap pack [-h] [-t <value>] [--password <value>] [--noPassword] [--upgrade] [--offline]
    [-u <value>] [--logger <value>] [-p <value>] [-a <value>] [-c <value>] [-r] [--report] [--ready]

FLAGS
  -a, --assembly=<value>      The assembly that defines the node(s) layout. It can be provided via custom preset or cli
                              parameter. If not provided, the value is resolved from the target/preset.yml file. Options
                              are: dual, peer, api, demo, multinode, services, my-custom-assembly.yml (advanced).
  -c, --customPreset=<value>  External preset file. Values in this file will override the provided presets.
  -h, --help                  It shows the help of this command.
  -p, --preset=<value>        The network preset. It can be provided via custom preset or cli parameter. If not
                              provided, the value is resolved from the target/preset.yml file. Options are: bootstrap,
                              testnet, mainnet, my-custom-network.yml (advanced, only for custom networks).
  -r, --reset                 It resets the configuration generating a new one.
  -t, --target=<value>        [default: target] The target folder where the symbol-bootstrap network is generated
  -u, --user=<value>          [default: current] User used to run docker images when creating configuration files like
                              certificates or nemesis block. "current" means the current user.
      --logger=<value>        [default: Console] The loggers the command will use. Options are: Console,File,Silent. Use
                              ',' to select multiple loggers.
      --noPassword            When provided, Bootstrap will not use a password, so private keys will be stored in plain
                              text. Use with caution.
      --offline               If --offline is used, Bootstrap resolves the configuration without querying the running
                              network.
      --password=<value>      A password used to encrypt and decrypt private keys in preset files like addresses.yml and
                              preset.yml. Bootstrap prompts for a password by default, can be provided in the command
                              line (--password=XXXX) or disabled in the command line (--noPassword).
      --ready                 If --ready is provided, the command will not ask offline confirmation.
      --report                It generates reStructuredText (.rst) reports describing the configuration of each node.
      --upgrade               It regenerates the configuration reusing the previous keys. Use this flag when upgrading
                              the version of bootstrap to keep your node up to date without dropping the local data.
                              Backup the target folder before upgrading.

DESCRIPTION
  It configures and packages your node into a zip file that can be uploaded to the final node machine.

EXAMPLES
  $ symbol-bootstrap pack

  $ symbol-bootstrap pack -c custom-preset.yml

  $ symbol-bootstrap pack -p testnet -a dual -c custom-preset.yml

  $ symbol-bootstrap pack -p mainnet -a dual --password 1234 -c custom-preset.yml

  $ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap pack -c custom-preset.yml
```

_See code: [src/commands/pack/index.ts](https://github.com/nemneshia/symbol-bootstrap/blob/v2.0.5/src/commands/pack/index.ts)_
