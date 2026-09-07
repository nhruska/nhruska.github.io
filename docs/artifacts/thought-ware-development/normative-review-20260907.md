# Normative Specification Review: Draft 0.1.1

Date: 2026-09-07
Scope: clause-level adversarial review of the v0.1 specification, Experiment 1
protocol, and evidence templates
Disposition: twelve material objections resolved in the proposal; empirical claims
remain unvalidated

## Review method

The review treated every normative clause as an attack surface and asked whether an
interested team could claim conformance, suppress an unfavorable outcome, or create a
nonreproducible success while following the literal text. It also checked terminology
against the ACM SIGSOFT Empirical Standards distinction between experiments,
reproducibility, and replication.

## Material objections and resolutions

| ID | Reviewer objection | Consequence before correction | Draft 0.1.1 resolution |
|---|---|---|---|
| NR-01 | Any MUST appeared waivable through an exception | A team could claim conformance while bypassing the method | Exceptions now authorize risk but leave the affected profile nonconforming |
| NR-02 | Conformance had no declared assessment boundary | One good change could imply product-wide or organization-wide conformance | Claims now identify scope, version, profile, date, assessor, and evidence bundle |
| NR-03 | “Independent” was aspirational rather than testable | A new agent session or vendor could be mislabeled independent | Independence now excludes candidate authorship and unilateral control of candidate, oracle, grader, or result |
| NR-04 | “High risk” had no classification rule | Teams could downgrade controls after seeing results | Risk tier and rubric are frozen before scenario construction, with mandatory harm categories |
| NR-05 | Acceptance criteria could change during evaluation | Goalposts could move to fit a candidate | Criteria, thresholds, and aggregation freeze before candidate results are inspected; later changes invalidate or amend results |
| NR-06 | Gate states overlapped without precedence | Identical evidence could receive different final states | Deterministic precedence and component-state retention are now required |
| NR-07 | Evidence “immutability” lacked an operational control | Bundles could change after approval | Manifests require hashes or an equivalent tamper-evident mechanism |
| NR-08 | Lifecycle labels did not define present authority | Deprecated or retired rules could re-enter retrieval as active | Lifecycle authority and transition metadata are now explicit |
| NR-09 | Profile claims lacked clause-level applicability and proof | Recorded adoption could be confused with full operational conformance | Recorded is now explicitly partial; Controlled is the minimum full-method profile and requires a clause matrix and independent assessment |
| NR-10 | False-pass rate could be improved by accepting nothing | A conservative but useless workflow could appear superior | Co-primary unacceptable-completion and independently verified success rates use all assigned tasks |
| NR-11 | The first prospective study was called a replication | The research design overstated its evidentiary status | Experiment 1 is now a controlled evaluation; replication is reserved for a later independent execution |
| NR-12 | Randomization, attrition, and repeated runs left room for pseudoreplication | Selective exclusions or counting trials as tasks could inflate confidence | Allocation concealment, intention-to-treat, flow counts, nested measurements, fidelity, and contamination controls are explicit |

## Remaining empirical blockers

The revisions make the proposal harder to game; they do not supply the missing data.
Before a confirmatory run, the program still requires:

- an independent research lead and disclosed conflict criteria;
- a frozen sampling frame and credible baseline;
- calibration data and a simulation-backed power analysis;
- task-specific oracles created before allocation;
- executable randomization, concealment, and blinding procedures;
- synthetic-data validation of the analysis code;
- an applicable human-participant and data-governance determination;
- public or reviewer-accessible reproducibility materials;
- a later study executed by a team independent of the method authors.

## Claim effect

Draft 0.1.1 strengthens the claim that the method is **specified and falsifiable**.
It does not strengthen claims of comparative effectiveness, causal benefit,
generalizability, or external validity. Those claims remain contingent on the
controlled evaluation and independent replication.

The immediate practical step is the twelve-unit feasibility design in
`experiment-1-calibration-runbook.md`: six matched task pairs across three domains,
split evenly between treatment and baseline. Its only permitted conclusion is whether
the study machinery is ready for a powered confirmatory evaluation.

## Primary standards consulted

- ACM SIGSOFT, [Empirical Standards for Software Engineering Research](https://www2.sigsoft.org/EmpiricalStandards/)
- ACM, [Artifact Review and Badging](https://www.acm.org/publications/policies/artifact-review-and-badging-current)
- NIST, [Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)
- Center for Open Science, [Preregistration](https://www.cos.io/initiatives/prereg)
