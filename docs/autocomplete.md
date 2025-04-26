`symbol-bootstrap autocomplete`
===============================

Display autocomplete installation instructions.

* [`symbol-bootstrap autocomplete [SHELL]`](#symbol-bootstrap-autocomplete-shell)

## `symbol-bootstrap autocomplete [SHELL]`

Display autocomplete installation instructions.

```
USAGE
  $ symbol-bootstrap autocomplete [SHELL] [-r]

ARGUMENTS
  SHELL  (zsh|bash|powershell) Shell type

FLAGS
  -r, --refresh-cache  Refresh cache (ignores displaying instructions)

DESCRIPTION
  Display autocomplete installation instructions.

EXAMPLES
  $ symbol-bootstrap autocomplete

  $ symbol-bootstrap autocomplete bash

  $ symbol-bootstrap autocomplete zsh

  $ symbol-bootstrap autocomplete powershell

  $ symbol-bootstrap autocomplete --refresh-cache
```

_See code: [@oclif/plugin-autocomplete](https://github.com/oclif/plugin-autocomplete/blob/v3.2.27/src/commands/autocomplete/index.ts)_
