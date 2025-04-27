# `symbol-bootstrap clean`

It removes the target folder deleting the generated configuration and data

- [`symbol-bootstrap clean`](#symbol-bootstrap-clean)

## `symbol-bootstrap clean`

It removes the target folder deleting the generated configuration and data

```
USAGE
  $ symbol-bootstrap clean [-h] [-t <value>] [--logger <value>]

FLAGS
  -h, --help            It shows the help of this command.
  -t, --target=<value>  [default: target] The target folder where the symbol-bootstrap network is generated
      --logger=<value>  [default: Console,File] The loggers the command will use. Options are: Console,File,Silent. Use
                        ',' to select multiple loggers.

DESCRIPTION
  It removes the target folder deleting the generated configuration and data

EXAMPLES
  $ symbol-bootstrap clean
```

_See code: [src/commands/clean/index.ts](https://github.com/nemneshia/symbol-bootstrap/blob/v2.0.6/src/commands/clean/index.ts)_
