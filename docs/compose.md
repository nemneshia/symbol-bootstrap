# `symbol-bootstrap compose`

It generates the `compose.yml` file from the configured network.

- [`symbol-bootstrap compose`](#symbol-bootstrap-compose)

## `symbol-bootstrap compose`

It generates the `compose.yml` file from the configured network.

```
USAGE
  $ symbol-bootstrap compose [-h] [-t <value>] [--password <value>] [--noPassword] [--upgrade] [--offline]
    [-u <value>] [--logger <value>]

FLAGS
  -h, --help              It shows the help of this command.
  -t, --target=<value>    [default: target] The target folder where the symbol-bootstrap network is generated
  -u, --user=<value>      [default: current] User used to run the services in the compose.yml file. "current" means the
                          current user.
      --logger=<value>    [default: Console,File] The loggers the command will use. Options are: Console,File,Silent.
                          Use ',' to select multiple loggers.
      --noPassword        When provided, Bootstrap will not use a password, so private keys will be stored in plain
                          text. Use with caution.
      --offline           If --offline is used, Bootstrap resolves the configuration without querying the running
                          network.
      --password=<value>  A password used to encrypt and decrypt private keys in preset files like addresses.yml and
                          preset.yml. Bootstrap prompts for a password by default, can be provided in the command line
                          (--password=XXXX) or disabled in the command line (--noPassword).
      --upgrade           It regenerates the docker compose and utility files from the <target>/docker folder

DESCRIPTION
  It generates the `compose.yml` file from the configured network.

EXAMPLES
  $ symbol-bootstrap compose
```

_See code: [src/commands/compose/index.ts](https://github.com/nemneshia/symbol-bootstrap/blob/v2.0.6/src/commands/compose/index.ts)_
