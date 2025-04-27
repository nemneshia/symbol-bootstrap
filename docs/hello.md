# `symbol-bootstrap hello`

Say hello

- [`symbol-bootstrap hello PERSON`](#symbol-bootstrap-hello-person)
- [`symbol-bootstrap hello:world`](#symbol-bootstrap-helloworld)

## `symbol-bootstrap hello PERSON`

Say hello

```
USAGE
  $ symbol-bootstrap hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ symbol-bootstrap hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/nemneshia/symbol-bootstrap/blob/v2.0.0/src/commands/hello/index.ts)_

## `symbol-bootstrap hello:world`

Say hello world

```
USAGE
  $ symbol-bootstrap hello:world

DESCRIPTION
  Say hello world

EXAMPLES
  $ symbol-bootstrap hello:world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/nemneshia/symbol-bootstrap/blob/v2.0.0/src/commands/hello/world.ts)_
