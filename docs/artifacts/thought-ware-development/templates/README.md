# v0.1 Artifact Templates

These templates implement `../specification-v0.1.md`. Copy a template for each new
record; do not overwrite historical evidence.

## Identifier convention

Use stable identifiers with a project prefix and sequence, for example:

- `MUSIC-FR-0042` - friction record
- `MUSIC-AR-0011` - authority record
- `MUSIC-GP-0037` - goalpost
- `MUSIC-SC-0111` - scenario fixture
- `MUSIC-RP-0037` - red proof
- `MUSIC-ER-20260906-01` - evaluation result
- `MUSIC-DR-0024` - decision record
- `MUSIC-EB-20260906-01` - evidence bundle
- `MUSIC-CA-20260906-01` - conformance assessment

## Required relationships

`Friction -> Authority -> Goalpost -> Scenario -> Red Proof -> Evaluation -> Evidence Bundle`

UAT, decision, exception, and retirement records attach to the relevant identifiers.
Every record declares lifecycle status. A superseded record remains available and
points to its replacement.

An approved exception records accepted risk but does not satisfy the waived
requirement. The affected scope reports `NONCONFORMING` for any profile that requires
that clause.

## Templates

- [Friction Record](friction-record.md)
- [Authority Record](authority-record.md)
- [Goalpost](goalpost.md)
- [Scenario Fixture](scenario-fixture.md)
- [Red Proof](red-proof.md)
- [Evaluation Result](evaluation-result.md)
- [UAT Capture](uat-capture.md)
- [Decision Record](decision-record.md)
- [Release Evidence Bundle](release-evidence-bundle.md)
- [Conformance Assessment](conformance-assessment.md)
- [Exception or Retirement Record](exception-retirement-record.md)
