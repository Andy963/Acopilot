# View Title Action Spacing Design

## Design

The three actions remain in the `navigation` group so VS Code continues to render them as primary view title actions.

The rank values are expanded:

1. `acopilot.newChat`: `navigation@1`
2. `acopilot.showHistory`: `navigation@10`
3. `acopilot.showSettings`: `navigation@20`

This keeps the action order unchanged while avoiding tightly packed consecutive ranks.

## Scope

Only the VS Code contribution manifest and its static menu test are changed.

## Risk

VS Code owns the final pixel rendering of native view title actions. This change uses the available manifest-level ordering control and keeps all commands in the primary navigation group.
