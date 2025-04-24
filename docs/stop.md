`symbol-bootstrap stop`
=======================

It stops the docker compose network if running (symbol-bootstrap started with --detached). This is just a wrapper for the `docker compose down` bash call.

* [`symbol-bootstrap stop`](#symbol-bootstrap-stop)

## `symbol-bootstrap stop`

It stops the docker compose network if running (symbol-bootstrap started with --detached). This is just a wrapper for the `docker compose down` bash call.

```
USAGE
  $ symbol-bootstrap stop [-h] [-t <value>] [--logger <value>]

FLAGS
  -h, --help            It shows the help of this command.
  -t, --target=<value>  [default: target] The target folder where the symbol-bootstrap network is generated
      --logger=<value>  [default: Console,File] The loggers the command will use. Options are: Console,File,Silent. Use
                        ',' to select multiple loggers.

DESCRIPTION
  It stops the docker compose network if running (symbol-bootstrap started with --detached). This is just a wrapper for
  the `docker compose down` bash call.

EXAMPLES
  $ symbol-bootstrap stop
```

_See code: [src/commands/stop/index.ts](https://github.com/nemneshia/symbol-bootstrap/blob/v2.0.6/src/commands/stop/index.ts)_
