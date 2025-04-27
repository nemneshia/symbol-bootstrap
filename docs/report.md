# `symbol-bootstrap report`

it generates reStructuredText (.rst) reports describing the configuration of each node.

- [`symbol-bootstrap report`](#symbol-bootstrap-report)

## `symbol-bootstrap report`

it generates reStructuredText (.rst) reports describing the configuration of each node.

```
USAGE
  $ symbol-bootstrap report [-h] [-t <value>] [--logger <value>]

FLAGS
  -h, --help            It shows the help of this command.
  -t, --target=<value>  [default: target] The target folder where the symbol-bootstrap network is generated
      --logger=<value>  [default: Console,File] The loggers the command will use. Options are: Console,File,Silent. Use
                        ',' to select multiple loggers.

DESCRIPTION
  it generates reStructuredText (.rst) reports describing the configuration of each node.

EXAMPLES
  $ symbol-bootstrap report
```

_See code: [src/commands/report/index.ts](https://github.com/nemneshia/symbol-bootstrap/blob/v2.0.6/src/commands/report/index.ts)_
