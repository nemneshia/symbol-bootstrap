`symbol-bootstrap wizard`
=========================

An utility command that will help you configuring node!

* [`symbol-bootstrap wizard`](#symbol-bootstrap-wizard)

## `symbol-bootstrap wizard`

An utility command that will help you configuring node!

```
USAGE
  $ symbol-bootstrap wizard

OPTIONS
  -c, --customPreset=customPreset             [default: custom-preset.yml] The custom preset to be created.
  -h, --help                                  It shows the help of this command.

  -t, --target=target                         [default: target] The target folder where the symbol-bootstrap network is
                                              generated

  --logger=logger                             [default: Console] The loggers the command will use. Options are:
                                              Console,File,Silent. Use ',' to select multiple loggers.

  --network=bootstrap|testnet|mainnet|custom  The node or network you want to create.

  --noPassword                                When provided, Bootstrap will not use a password, so private keys will be
                                              stored in plain text. Use with caution.

  --password=password                         A password used to encrypt and decrypt private keys in preset files like
                                              addresses.yml and preset.yml. Bootstrap prompts for a password by default,
                                              can be provided in the command line (--password=XXXX) or disabled in the
                                              command line (--noPassword).

  --ready                                     If --ready is provided, the command will not ask offline confirmation.

EXAMPLE
  $ symbol-bootstrap wizard
```

_See code: [src/commands/wizard.ts](https://github.com/nemneshia/symbol-bootstrap/blob/v1.1.13/src/commands/wizard.ts)_
