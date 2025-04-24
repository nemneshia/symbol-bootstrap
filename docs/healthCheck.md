`symbol-bootstrap healthCheck`
==============================

It checks if the services created with docker compose are up and running.

This command checks:
- Whether the docker containers are running.
- Whether the services' exposed ports are listening.
- Whether the rest gateways' /node/health are OK.

The health check process handles 'repeat' and custom 'openPort' services.

* [`symbol-bootstrap healthCheck`](#symbol-bootstrap-healthcheck)

## `symbol-bootstrap healthCheck`

It checks if the services created with docker compose are up and running.

```
USAGE
  $ symbol-bootstrap healthCheck [-h] [-t <value>] [--logger <value>]

FLAGS
  -h, --help            It shows the help of this command.
  -t, --target=<value>  [default: target] The target folder where the symbol-bootstrap network is generated
      --logger=<value>  [default: Console,File] The loggers the command will use. Options are: Console,File,Silent. Use
                        ',' to select multiple loggers.

DESCRIPTION
  It checks if the services created with docker compose are up and running.

  This command checks:
  - Whether the docker containers are running.
  - Whether the services' exposed ports are listening.
  - Whether the rest gateways' /node/health are OK.

  The health check process handles 'repeat' and custom 'openPort' services.


EXAMPLES
  $ symbol-bootstrap healthCheck
```

_See code: [src/commands/healthCheck/index.ts](https://github.com/nemneshia/symbol-bootstrap/blob/v2.0.6/src/commands/healthCheck/index.ts)_
