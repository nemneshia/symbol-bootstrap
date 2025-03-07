`symbol-bootstrap decrypt`
==========================

It decrypts a yml file using the provided password. The source file can be a custom preset file, a preset.yml file or an addresses.yml.

The main use case of this command is to verify private keys in encrypted files after encrypting a custom preset or running a bootstrap command with a provided --password.

* [`symbol-bootstrap decrypt`](#symbol-bootstrap-decrypt)

## `symbol-bootstrap decrypt`

It decrypts a yml file using the provided password. The source file can be a custom preset file, a preset.yml file or an addresses.yml.

```
USAGE
  $ symbol-bootstrap decrypt --source <value> --destination <value> [-h] [--password <value>] [--logger
    <value>]

FLAGS
  -h, --help                 It shows the help of this command.
      --destination=<value>  (required) The destination decrypted file to create. The destination file must not exist.
      --logger=<value>       [default: Console] The loggers the command will use. Options are: Console,File,Silent. Use
                             ',' to select multiple loggers.
      --password=<value>     The password to use to decrypt the source file into the destination file. Bootstrap prompts
                             for a password by default, can be provided in the command line (--password=XXXX) or
                             disabled in the command line (--noPassword).
      --source=<value>       (required) The source encrypted yml file to be decrypted.

DESCRIPTION
  It decrypts a yml file using the provided password. The source file can be a custom preset file, a preset.yml file or
  an addresses.yml.

  The main use case of this command is to verify private keys in encrypted files after encrypting a custom preset or
  running a bootstrap command with a provided --password.

EXAMPLES
  $ symbol-bootstrap start --password 1234 --preset testnet --assembly dual --customPreset decrypted-custom-preset.yml --detached
  $ symbol-bootstrap decrypt --password 1234 --source target/addresses.yml --destination plain-addresses.yml
  $ symbol-bootstrap decrypt --password 1234 --source encrypted-custom-preset.yml --destination plain-custom-preset.yml
  $ cat plain-addresses.yml
  $ cat plain-custom-preset.yml
  $ rm plain-addresses.yml
  $ rm plain-custom-preset.yml
        

  $ symbol-bootstrap start --preset testnet --assembly dual --customPreset decrypted-custom-preset.yml --detached
  > password prompt
  $ symbol-bootstrap decrypt --source target/addresses.yml --destination plain-addresses.yml
  > password prompt (enter the same password)
  $ symbol-bootstrap decrypt --source encrypted-custom-preset.yml --destination plain-custom-preset.yml
  > password prompt (enter the same password)
  $ cat plain-addresses.yml
  $ cat plain-custom-preset.yml
  $ rm plain-addresses.yml
  $ rm plain-custom-preset.yml

  $ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap decrypt --source target/addresses.yml --destination plain-addresses.yml
```

_See code: [src/commands/decrypt/index.ts](https://github.com/nemneshia/symbol-bootstrap/blob/v2.0.2/src/commands/decrypt/index.ts)_
