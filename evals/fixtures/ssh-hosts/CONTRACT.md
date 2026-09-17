# SSH configuration editing contract

`listHosts` reports fields explicitly written in ordinary single-alias Host blocks, not effective SSH settings. Quoted identity paths are returned without their quotes. Object property order and error prose are not contracts.

`updateConfig` supports adding, setting, renaming and removing single aliases. Alias collisions are case-insensitive. Ambiguous blocks and files containing Include or Match are refused, as are malformed or quoted/escaped Host patterns. Ports accept integer strings from 1 through 65535; values must not introduce extra directives.

New specific hosts precede wildcard defaults because OpenSSH uses the first matching value. Unrelated entries, comments, unknown options and existing line endings remain intact. Editing a known option must retain its inline comment. Removal deletes that host's connection settings while retaining trailing comments for the next host.

File-backed commands replace configs atomically, preserve existing permission bits and use 0600 for a new config. Linked config files are refused. The ordinary CLI defaults to the user's `.ssh/config`; `--config` selects a separate file. The tool never opens identity keys or connects to SSH servers.
