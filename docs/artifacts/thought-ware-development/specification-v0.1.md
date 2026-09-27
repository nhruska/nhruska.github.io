# Thought-Ware Development Method Specification v0.1

Status: proposed experimental specification
Date: 2026-09-06
Draft revision: 0.1.1 (normative-review corrections, 2026-09-07)
Maturity: operational single-product method; controlled evaluation and independent replication not yet completed
Public name: unresolved; see `naming-review-20260906.md`

## 1. Purpose

This specification defines a technology-neutral method for converting observed user
friction into versioned, executable acceptance evidence for agent-assisted software
development. It is designed to let generative systems propose and implement changes
without giving their confidence or fluency release authority.

The method's operational core is the **friction-to-goalpost loop**:

> observed friction -> authority -> goalpost -> red proof -> implementation ->
> evaluation -> human acceptance -> release evidence -> observation -> learning

The specification separates what is currently practiced from what has been
scientifically validated. Conformance to this document does not itself prove that the
method improves software outcomes.

## 2. Normative language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, and
**MAY** are normative requirements. A conforming implementation MUST document every
intentional deviation from a MUST requirement as a time-bounded exception.

Unless a clause explicitly states that it is research-only or Recorded-only, a MUST
requirement applies to the `Controlled`, `Evaluated`, and `Replicated` profiles. The
`Recorded` profile is a bounded adoption profile governed only by its explicit
requirements in Section 13; it MUST NOT be represented as full operational
conformance.

An exception documents and authorizes risk; it does not make an unsatisfied
requirement satisfied. A scope with an active exception to a profile requirement MUST
report `NONCONFORMING` for that profile and MAY claim a lower profile only when all of
that profile's requirements are satisfied. Research reports MUST include all active
exceptions and MUST NOT silently exclude nonconforming units.

Normative requirements apply only to the declared conformance scope. A conformance
claim MUST identify the product or workflow, change or release boundary, method
version, profile, assessment date, and evidence bundle.

## 3. Scope

This specification applies to agent-assisted changes that can produce inspectable
artifacts and observable outcomes. It supports:

- user-facing behavior;
- deterministic business and domain rules;
- accessibility and interaction safety;
- security and privacy controls;
- data migrations and integrity;
- resilience, performance, and operational behavior;
- subjective quality judgments when an identified human or calibrated model grader is
  used.

It does not claim that all requirements are deterministic, that simulated personas
replace human research, or that a passing gate proves the governing specification is
correct.

## 4. Core terms

| Term | Normative meaning |
|---|---|
| Friction Record | Evidence-bearing description of an observed impediment, failure, risk, or unmet outcome. |
| Authority Record | Versioned statement of the source, owner, applicability, status, and conflicts governing a rule. |
| Goalpost | Observable acceptance target derived from authorized friction and bounded by exclusions and risk. |
| Scenario Fixture | Reproducible environment, state, permissions, actions, and observations used to evaluate a goalpost. |
| Persona Fixture | A scenario fixture whose initial state represents a declared user archetype. It is not a human participant. |
| Oracle | The authorized source used to determine what an acceptable result means. |
| Grader | A code, model, or human procedure that compares observed evidence with an oracle. |
| Red Proof | Evidence that the pre-change system fails the new goalpost for the expected reason. |
| Evidence Bundle | Immutable or content-addressed collection sufficient to reconstruct a gate decision. |
| Gate | Policy that maps valid evidence to a release state. |
| Exception | Authorized, time-bounded deviation from a normative requirement. |
| Supersession | Explicit replacement of a rule, decision, scenario, or result by another identified artifact. |
| Change Unit | The smallest change or release boundary for which one conformance and gate decision is made. |
| Risk Tier | A project-defined ordinal classification assigned before evaluation and used to select required controls. |
| Independent | Free from authorship of the candidate and from unilateral ability to change the candidate, oracle, goalpost, grader, or reported outcome during evaluation. |

## 5. Governing principles

### 5.1 Evidence has authority; confidence does not

An agent assertion MUST NOT change release state without evidence accepted by the
applicable gate. Fluency, vendor identity, model consensus, or reviewer persona MUST
NOT be treated as proof.

### 5.2 Authority precedes automation

Every active business or domain rule applicable to the Change Unit MUST identify an
authority source and accountable owner. When sources conflict or authority is absent,
evaluation MUST return `BLOCKED` or `UNVERIFIED`, never `PASS`.

### 5.3 Acceptance is independent of implementation

The implementation under evaluation MUST NOT silently redefine its own acceptance
criteria. Any change to an active oracle, goalpost, fixture, or grader in the same
change unit MUST be approved before confirmatory evaluation by an authorized party
independent of candidate implementation. After evaluation starts, such a change
invalidates the affected confirmatory result unless handled as a disclosed protocol
amendment and reevaluated.

For low- and medium-risk operational work, one human MAY perform multiple roles only
when the evidence records each role transition and a second qualified reviewer
independently approves the gate. High-risk work MUST use separate accountable humans
for implementation and final approval. A model, model vendor, or separate agent
session does not establish organizational independence.

### 5.4 Gates fail closed

Missing tools, missing evidence, an unavailable environment, contradictory rules,
invalid artifacts, or grader failure MUST NOT produce `PASS`.

### 5.5 Red is demonstrated

A new corrective goalpost MUST produce a Red Proof before the implementation is
accepted. A previously observed production failure MAY satisfy the requirement when
its evidence is linked and replayable. A declaration that a scenario was written
"red first" is insufficient without a failing run or approved exception.

### 5.6 Evidence is traceable and versioned

Every gate decision MUST identify the exact system revision, scenario version, oracle
version, grader version, environment, outcome, and evidence artifacts.

### 5.7 Claims are bounded by evidence

Method claims MUST state the population, task classes, environments, models, graders,
and observation period tested. Results from a single product MUST NOT be generalized
to all products, users, agents, or domains.

### 5.8 Human attention is a measured constraint

The method SHOULD minimize unnecessary operator interruption while preserving human
authority. Human attention time MUST be measured when reduced operator burden is a
claimed benefit.

### 5.9 Active knowledge has a lifecycle

Rules, decisions, scenarios, and exceptions MUST declare status. Retired or superseded
content MUST remain traceable but MUST NOT appear active to agents or evaluators.

## 6. Required roles

| Role | Responsibility |
|---|---|
| Product authority | Chooses priorities, risk tolerance, and intended user outcomes. |
| Domain authority | Owns or approves domain rules and resolves source conflicts. |
| Method steward | Maintains the method version and records deviations. |
| Implementer | Produces the candidate change; may be human, agent, or mixed. |
| Oracle owner | Approves what counts as correct before confirmatory evaluation. |
| Evaluator | Executes graders and records outcomes without altering the candidate. |
| Release approver | Accepts residual risk and authorizes release. |
| Research evaluator | For methodology experiments, analyzes results independently of implementation. |

Role names describe functions, not job titles. Agents MAY assist any role but MUST NOT
be represented as holding human accountability or professional credentials they do
not possess.

### 6.1 Risk classification and role conflicts

Before scenario construction, the Product authority MUST assign the Change Unit a
risk tier using a versioned project rubric and record the rationale. The rubric MUST
define at least low, medium, and high tiers, escalation conditions, and the controls
required by each tier. A change MUST be high risk when failure could plausibly cause
material safety, security, privacy, legal, financial, accessibility, irreversible-data,
or critical-operations harm unless a stricter governing framework applies.

Every accountable reviewer MUST disclose authorship, reporting-line, financial, and
other material conflicts that could influence the gate. A conflict does not always
disqualify a reviewer, but an unresolved conflict MUST prevent that reviewer from
being the sole independent approver.

## 7. Artifact lifecycle

### 7.1 Observe

- Work proposed as a response to material observed friction MUST begin with a Friction
  Record. “Material” means capable of changing priority, acceptance, release risk, or
  an intended user or system outcome under the project's declared rubric.
- The record MUST separate verbatim observation from interpretation.
- Inferred friction MAY enter discovery but MUST be labeled `HYPOTHESIS` until observed
  or authorized.

### 7.2 Establish authority

- Applicable rules MUST be captured in Authority Records.
- Each record MUST contain owner, source, version or date, status, scope, and known
  conflicts.
- A wiki MAY serve as the canonical registry, but registry claims SHOULD be checked
  against code, tests, primary sources, and current decisions.

### 7.3 Define the goalpost

- The Goalpost MUST specify initial state, action or stimulus, observable outcome,
  exclusions, risk, and applicable user or system state.
- A Goalpost MUST be implementation-neutral unless implementation form is itself an
  authorized requirement.
- Subjective outcomes MUST identify the authorized grader and rubric.

### 7.4 Construct the scenario

- The Scenario Fixture MUST declare its class, environment, seed data, tools,
  permissions, steps, observations, negative controls, and trial count.
- Expected results MUST derive from an independent oracle, not the implementation
  under test.
- Arbitrary executable assertions SHOULD be minimized. Where used, they MUST receive
  code review and disclose dependencies.

### 7.5 Demonstrate red

- The evaluator MUST run the scenario against the pre-change revision.
- The failure MUST occur for the expected reason.
- Infrastructure or harness failure does not satisfy red.

### 7.6 Implement

- The candidate change MUST link to its friction, authority, goalpost, scenario, and
  Red Proof identifiers.
- The implementer MAY generate multiple candidates.
- Candidate count, model confidence, or agreement between agents MUST NOT alter the
  gate.

### 7.7 Evaluate

- Required graders MUST execute in the declared environment.
- The evaluation plan, aggregation rule, thresholds, and required evidence MUST be
  frozen before the candidate result is inspected.
- Stochastic outcomes MUST use the preregistered number of independent trials.
- Evaluators MUST preserve per-trial results, not only aggregates.
- Negative controls and corruption tests MUST be used for high-risk gates and SHOULD
  be used for other gates.

### 7.8 Conduct UAT

- Operator UAT, external-participant research, expert review, and simulated-persona
  evaluation MUST be reported as distinct evidence classes.
- Human interpretation MUST be separated from verbatim participant evidence.
- A Persona Fixture MUST NOT be described as a real user.

### 7.9 Decide and release

- A release decision MUST cite an Evidence Bundle.
- The bundle MUST state unresolved risk, exceptions, approval, rollback, and monitoring.
- Advisory review, required review, and technically enforced merge controls MUST be
  described separately.

### 7.10 Observe and learn

- Escaped defects and production outcomes SHOULD be linked back to the release bundle.
- A material escaped defect MUST create or update a regression scenario and SHOULD
  trigger a control-improvement review.
- Regression scenarios remain active until explicitly superseded or retired.

## 8. Scenario classes

Every scenario MUST declare one primary class:

| Class | Primary question |
|---|---|
| Persona | Can the declared archetype state complete the intended task? |
| Capability | Does the requested functional outcome occur? |
| Domain rule | Is an authorized business or domain rule applied correctly? |
| Accessibility | Can supported users perceive and operate the result? |
| Security/privacy | Does the change preserve declared protections and abuse boundaries? |
| Data/migration | Are data meaning, integrity, compatibility, and recovery preserved? |
| Resilience | Does the system fail and recover within declared limits? |
| Performance | Does measured behavior remain within an authorized threshold? |
| Human judgment | Does an authorized human rubric accept the result? |

A scenario MAY carry secondary classes, but persona scenarios MUST NOT stand in for
security, migration, resilience, or performance evaluation.

## 9. Grader classes

| Grader | Appropriate use | Required control |
|---|---|---|
| Deterministic code | Exact rules, schemas, calculations, invariants | Independent expected values and corruption test |
| Render/interaction | Geometry, state transitions, visible behavior | Real rendering, stable environment, screenshot or trace |
| Statistical | Latency, reliability, stochastic outcomes | Repeated trials, uncertainty, declared aggregation |
| Model | Semantic or qualitative judgments at scale | Versioned prompt/model, calibration to humans, abstention |
| Human | Taste, usability, domain judgment, risk acceptance | Identified authority, rubric, verbatim evidence where applicable |

No grader class is universally superior. High-risk changes SHOULD combine graders
whose failure modes are meaningfully different.

## 10. Gate states

Every evaluated goalpost MUST end in exactly one state:

| State | Meaning |
|---|---|
| `PASS` | All required evidence is valid and all applicable thresholds are satisfied. |
| `FAIL` | Valid evidence shows at least one applicable threshold is not satisfied. |
| `BLOCKED` | A required authority, dependency, permission, or decision is unavailable. |
| `UNVERIFIED` | The claim was not adequately tested or observed. |
| `INVALID_EVIDENCE` | Evidence exists but cannot support a decision because it is stale, corrupt, mismatched, or produced by an invalid procedure. |

`SUPERSEDED` and `RETIRED` are lifecycle states for artifacts, not evaluation outcomes.

When more than one condition applies to a goalpost, the evaluator MUST retain every
underlying finding and assign the final state using this precedence:

1. `FAIL` when any valid required observation violates a threshold;
2. `INVALID_EVIDENCE` when no valid failure is established and required evidence is
   stale, corrupt, mismatched, or procedurally invalid;
3. `BLOCKED` when no failure or invalid evidence is established and an external
   authority, dependency, permission, or decision prevents evaluation;
4. `UNVERIFIED` when evaluation was possible but required coverage or observation is
   insufficient;
5. `PASS` only when every required threshold and evidence obligation is satisfied.

An aggregate release gate MUST use the same precedence across required goalposts and
MUST expose component states rather than reporting only the aggregate.

## 11. Evidence Bundle minimum

An Evidence Bundle MUST include:

- bundle identifier and timestamp;
- method version, conformance scope, profile, and conformance result;
- candidate revision;
- Change Unit and risk tier with rationale;
- friction, authority, goalpost, and scenario identifiers;
- pre-change revision and Red Proof;
- environment and dependency versions;
- oracle and grader versions;
- every required trial outcome;
- logs, screenshots, traces, or other referenced artifacts;
- deviations, missing evidence, and exceptions;
- reviewer conflicts and independence determination;
- unresolved risks;
- approver and decision;
- rollback and monitoring plan;
- evidence-manifest hashes or an equivalent tamper-evident preservation mechanism.

An evidence summary MUST be mechanically derived from, or reconciled against, the
underlying records. Summary counts MUST NOT be maintained independently without a
consistency check.

## 12. Knowledge and decision lifecycle

Every governed artifact MUST declare one lifecycle state:

- `PROPOSED`
- `ACTIVE`
- `DEPRECATED`
- `SUPERSEDED`
- `RETIRED`
- `REJECTED`
- `EXPIRED` (exceptions only)

Active records MUST identify their effective date or version. Superseded records MUST
identify their replacement. Generated documentation MUST identify its sources and MUST
be regenerated or fail a drift check when those sources change.

`DEPRECATED` means still applicable during a declared transition; `SUPERSEDED` means
replaced and no longer authoritative; `RETIRED` means intentionally removed without
an active replacement; and `REJECTED` means never activated. Only `ACTIVE`, and
`DEPRECATED` within its declared transition window, MAY supply current authority.
Lifecycle transitions MUST identify the approver, effective time, reason, and any
replacement. Historical records MUST remain immutable or version-addressed.

## 13. Conformance profiles

| Profile | Required evidence and permitted claim |
|---|---|
| Recorded | Friction, authority, goalpost, scenario, evaluation, and decision artifacts identify their versions, lifecycle states, relationships, known missing evidence, and accountable owners. The scope may claim only “Recorded adoption.” |
| Controlled | Recorded plus every applicable operational MUST in this specification, independent acceptance control, fail-closed states, Red Proof, and evidence that the promotion policy was enforced. This is the minimum full-method conformance profile. |
| Evaluated | Controlled plus preregistered comparison with a credible baseline. |
| Replicated | Evaluated plus a new execution of the frozen study by a team independent of the method's authors. |

A project MUST state the exact profile achieved and publish a requirement-by-
requirement conformance matrix. Self-attestation MAY establish `Recorded`, but the
word “conforming” without qualification MUST mean `Controlled` or higher.
`Controlled` requires an independent reviewer and evidence that promotion controls
were actually enforced for the declared scope. `Evaluated` requires a frozen,
preregistered comparison and an analysis that includes every randomized unit.
`Replicated` requires a new execution by a team independent of the method's authors,
not merely computational reproduction of the original analysis.

A project MUST NOT use `Evaluated` or `Replicated` based only on internal case-study
evidence. A profile is not inherited by an entire organization or product from one
conforming Change Unit.

## 14. Method evaluation metrics

Claims about method effectiveness SHOULD prioritize:

- unacceptable-completion incidence and false pass among declared completions;
- escaped acceptance defects, including severity;
- independently judged task success;
- evaluator agreement;
- time to verified release;
- human attention minutes;
- rework rate;
- evidence completeness;
- specification-drift rate;
- cost per accepted change;
- production outcome during the declared observation period.

Commit counts, pull-request counts, scenario counts, and model-token counts MAY describe
activity but MUST NOT be presented as quality or user-impact evidence.

Every reported rate MUST publish its numerator, denominator, unit of analysis,
observation window, missing-data treatment, and uncertainty interval. A method
evaluation MUST report both unacceptable-completion incidence and independently
verified task success so that a workflow cannot appear safer merely by completing or
accepting fewer tasks.

## 15. Explicit non-claims

Conformance to v0.1 does not establish that:

- agents are CTOs, accountable executives, or subject-matter authorities;
- business requirements are inherently deterministic;
- a different model vendor is an independent scientific evaluator;
- simulated personas reproduce all human behavior;
- every feature should become a persona scenario;
- every regression must remain active forever;
- one operator's acceptance generalizes to external users;
- the method works for any application, domain, user, or task.

## 16. Versioning and change control

- The method version used for confirmatory evaluation MUST be frozen before data
  collection.
- Discoveries during an evaluation MUST enter a subsequent version or a documented
  protocol amendment.
- A protocol amendment after confirmatory data collection begins MUST be disclosed and
  analyzed separately from preregistered hypotheses.
- Method revisions SHOULD include migration guidance for active templates and gates.

### 16.1 Draft revision record

- 0.1.0 (2026-09-06): initial proposed specification.
- 0.1.1 (2026-09-07): clarified exception semantics, conformance scope, independence,
  risk classification, frozen evaluation criteria, gate-state precedence, evidence
  integrity, lifecycle authority, profile assessment, and non-gameable rate reporting.

## 17. References

- ACM SIGSOFT, [Empirical Standards for Software Engineering Research](https://www2.sigsoft.org/EmpiricalStandards/)
- ACM, [Artifact Review and Badging](https://www.acm.org/publications/policies/artifact-review-and-badging-current)
- NIST, [Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- Anthropic, [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- Center for Open Science, [Preregistration](https://www.cos.io/initiatives/prereg)

## Appendix A. Conformance checklist

- [ ] Method version is identified and frozen for the evaluation period.
- [ ] Conformance scope, profile, assessor, and requirement matrix are identified.
- [ ] Risk tier and role conflicts are recorded before evaluation.
- [ ] Every active rule has authority, owner, scope, status, and version.
- [ ] Friction evidence is separated from interpretation.
- [ ] Goalposts are observable and implementation-neutral.
- [ ] Scenarios declare class, environment, fixtures, graders, and trial count.
- [ ] Expected values are independent of the candidate implementation.
- [ ] Red Proof exists or has an approved exception.
- [ ] Missing or invalid evidence cannot pass.
- [ ] UAT evidence classes are reported accurately.
- [ ] Evidence Bundle reconstructs the gate decision.
- [ ] Exceptions expire and superseded records identify replacements.
- [ ] Every rate exposes its numerator, denominator, unit, window, and missing data.
- [ ] Claims stay within the evaluated population and task classes.
