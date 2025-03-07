`symbol-bootstrap link`
=======================

It announces VRF and Voting Link transactions to the network for each node with 'Peer' or 'Voting' roles. This command finalizes the node registration to an existing network.

* [`symbol-bootstrap link`](#symbol-bootstrap-link)

## `symbol-bootstrap link`

It announces VRF and Voting Link transactions to the network for each node with 'Peer' or 'Voting' roles. This command finalizes the node registration to an existing network.

```
USAGE
  $ symbol-bootstrap link [-h] [-t <value>] [--unlink] [--password <value>] [--noPassword] [-u <value>]
    [--useKnownRestGateways] [--ready] [--maxFee <value>] [-c <value>] [--serviceProviderPublicKey <value>] [--logger
    <value>]

FLAGS
  -c, --customPreset=<value>              This command uses the encrypted addresses.yml to resolve the main private key.
                                          If the main private is only stored in the custom preset, you can provide it
                                          using this param. Otherwise, the command may ask for it when required.
  -h, --help                              It shows the help of this command.
  -t, --target=<value>                    [default: target] The target folder where the symbol-bootstrap network is
                                          generated
  -u, --url=<value>                       [default: http://localhost:3000] the network url
      --logger=<value>                    [default: Console] The loggers the command will use. Options are:
                                          Console,File,Silent. Use ',' to select multiple loggers.
      --maxFee=<value>                    the max fee used when announcing (absolute). The node min multiplier will be
                                          used if it is not provided.
      --noPassword                        When provided, Bootstrap will not use a password, so private keys will be
                                          stored in plain text. Use with caution.
      --password=<value>                  A password used to encrypt and decrypt private keys in preset files like
                                          addresses.yml and preset.yml. Bootstrap prompts for a password by default, can
                                          be provided in the command line (--password=XXXX) or disabled in the command
                                          line (--noPassword).
      --ready                             If --ready is provided, the command will not ask for confirmation when
                                          announcing transactions.
      --serviceProviderPublicKey=<value>  Public key of the service provider account, used when the transaction
                                          announcer(service provider account) is different than the main account private
                                          key holder
      --unlink                            Perform "Unlink" transactions unlinking the voting and VRF keys from the node
                                          signer account
      --useKnownRestGateways              Use the best NEM node available when announcing. Otherwise the command will
                                          use the node provided by the --url parameter.

DESCRIPTION
  It announces VRF and Voting Link transactions to the network for each node with 'Peer' or 'Voting' roles. This command
  finalizes the node registration to an existing network.

EXAMPLES
  $ symbol-bootstrap link

  $ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap link --unlink --useKnownRestGateways
```

_See code: [src/commands/link/index.ts](https://github.com/nemneshia/symbol-bootstrap/blob/v2.0.2/src/commands/link/index.ts)_
