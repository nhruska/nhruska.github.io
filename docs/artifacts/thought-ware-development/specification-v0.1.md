# Thought-Ware Development Method Specification v0.1

Status: proposed experimental specification  
Date: 2026-09-06  
Maturity: operational single-product method; controlled replication not yet completed  
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

## 5. Governing principles

### 5.1 Evidence has authority; confidence does not

An agent assertion MUST NOT change release state without evidence accepted by the
applicable gate. Fluency, vendor identity, model consensus, or reviewer persona MUST
NOT be treated as proof.

### 5.2 Authority precedes automation

Every active business or domain rule MUST identify an authority source and accountable
owner. When sources conflict or authority is absent, evaluation MUST return `BLOCKED`
or `UNVERIFIED`, never `PASS`.

### 5.3 Acceptance is independent of implementation

The implementation under evaluation MUST NOT silently redefine its own acceptance
criteria. Any change to an active oracle, goalpost, fixture, or grader in the same
change set MUST receive explicit review from an authorized party independent of the
implementation decision.

Organizationally separate people are preferred. Where staffing prevents separation,
the same person MAY perform multiple roles only when the evidence records the role
transition and an independent later review is required before a high-risk release.

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

## 7. Artifact lifecycle

### 7.1 Observe

- A material issue MUST begin with a Friction Record.
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
- Stochastic outcomes MUST use the preregistered number of independent trials.
- Evaluators MUST preserve per-trial results, not only aggregates.
- Negative controls and corruption tests SHOULD be used for high-risk gates.

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

## 11. Evidence Bundle minimum

An Evidence Bundle MUST include:

- bundle identifier and timestamp;
- candidate revision;
- friction, authority, goalpost, and scenario identifiers;
- pre-change revision and Red Proof;
- environment and dependency versions;
- oracle and grader versions;
- every required trial outcome;
- logs, screenshots, traces, or other referenced artifacts;
- deviations, missing evidence, and exceptions;
- unresolved risks;
- approver and decision;
- rollback and monitoring plan.

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

Active records MUST identify their effective date or version. Superseded records MUST
identify their replacement. Generated documentation MUST identify its sources and MUST
be regenerated or fail a drift check when those sources change.

## 13. Conformance profiles

| Profile | Required evidence |
|---|---|
| Recorded | Required artifacts and traceability exist. |
| Controlled | Recorded plus independent acceptance control, fail-closed states, Red Proof, and enforced promotion policy. |
| Evaluated | Controlled plus preregistered comparison with a credible baseline. |
| Replicated | Evaluated plus reproduction by a team independent of the method's authors. |

A project MUST state the exact profile achieved. It MUST NOT use `Evaluated` or
`Replicated` based only on internal case-study evidence.

## 14. Method evaluation metrics

Claims about method effectiveness SHOULD prioritize:

- false-pass rate;
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

## 17. References

- ACM SIGSOFT, [Empirical Standards for Software Engineering Research](https://www2.sigsoft.org/EmpiricalStandards/)
- ACM, [Artifact Review and Badging](https://www.acm.org/publications/policies/artifact-review-and-badging-current)
- NIST, [Artificial Intelligence Risk Management Framework: Generative Artificial Intelligence Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- Anthropic, [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- Open Science Community, [Preregistration guidance](https://guide.opens.science/preregistration.html)

## Appendix A. Conformance checklist

- [ ] Method version is identified and frozen for the evaluation period.
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
- [ ] Claims stay within the evaluated population and task classes.
