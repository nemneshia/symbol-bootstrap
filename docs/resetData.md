# `symbol-bootstrap resetData`

It removes the data keeping the generated configuration, certificates, keys and block 1.

- [`symbol-bootstrap resetData`](#symbol-bootstrap-resetdata)

## `symbol-bootstrap resetData`

It removes the data keeping the generated configuration, certificates, keys and block 1.

```
USAGE
  $ symbol-bootstrap resetData [-h] [-t <value>] [--logger <value>]

FLAGS
  -h, --help            It shows the help of this command.
  -t, --target=<value>  [default: target] The target folder where the symbol-bootstrap network is generated
      --logger=<value>  [default: Console,File] The loggers the command will use. Options are: Console,File,Silent. Use
                        ',' to select multiple loggers.

DESCRIPTION
  It removes the data keeping the generated configuration, certificates, keys and block 1.

EXAMPLES
  $ symbol-bootstrap resetData
```

_See code: [src/commands/resetData/index.ts](https://github.com/nemneshia/symbol-bootstrap/blob/v2.0.6/src/commands/resetData/index.ts)_
