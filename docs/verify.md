`symbol-bootstrap verify`
=========================

It tests the installed software in the current computer reporting if there is any missing dependency, invalid version, or software related issue.

* [`symbol-bootstrap verify`](#symbol-bootstrap-verify)

## `symbol-bootstrap verify`

It tests the installed software in the current computer reporting if there is any missing dependency, invalid version, or software related issue.

```
USAGE
  $ symbol-bootstrap verify [-h] [--logger <value>]

FLAGS
  -h, --help            It shows the help of this command.
      --logger=<value>  [default: Console,File] The loggers the command will use. Options are: Console,File,Silent. Use
                        ',' to select multiple loggers.

DESCRIPTION
  It tests the installed software in the current computer reporting if there is any missing dependency, invalid version,
  or software related issue.

EXAMPLES
  $ symbol-bootstrap verify
```

_See code: [src/commands/verify/index.ts](https://github.com/nemneshia/symbol-bootstrap/blob/v2.0.6/src/commands/verify/index.ts)_
