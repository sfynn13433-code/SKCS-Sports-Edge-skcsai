# SKCS Naming Standards

## Database

- Tables use lower_snake_case.
- Views should clearly signal whether they are compatibility surfaces or preferred read paths.
- Functions should be prefixed when they belong to a subsystem or when the name would otherwise collide.

## Documentation

- File names should match the knowledge-layer category and purpose.
- Each file should state whether it is inventory, audit, or governance.

## Python / Node / SQL

- Runtime helpers should use consistent subsystem prefixes.
- Provider-specific helpers should be named to reflect the provider and intent.

## Prediction formulas

- Formula names should include the version when the logic changes materially.
- If a formula becomes authoritative in SQL, that should be reflected in the registry.
