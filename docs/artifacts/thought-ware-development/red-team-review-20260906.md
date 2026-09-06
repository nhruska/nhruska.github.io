# Adversarial Methodology Review

Date: 2026-09-06  
Scope: public Thought-Ware Development pages, music engineering wiki, repository
controls, test corpus, UAT records, and supporting research attachments  
Disposition: method survives with narrowed claims; controlled validation required

## Executive finding

The repository demonstrates an unusually mature operational practice in one product:
friction records, executable persona states, red-first scenarios, deterministic domain
canon, corruption tests, operator UAT, source-of-truth registries, decision records,
and evidence-oriented release work all exist in working form.

It does not yet demonstrate a portable, causally validated methodology. The public
narrative sometimes treats practiced behavior as an enforced control, simulated
personas as real users, cross-vendor review as independent proof, and reproducible
gate decisions as if all underlying business truth were deterministic.

The defensible contribution is narrower and stronger:

> A generative implementation receives no release authority from confidence. Release
> state changes only through current, valid, independently evaluated evidence tied to
> observed friction and an authorized goalpost.

## Evidence supporting the method

- Seventy Node test files passed in the review environment with zero failed files.
- The theory corpus includes 2,151 harmony-query assertions and a 1,008-check core
  canon, supplemented by key-spelling traps and corruption tests.
- The browser suite contains 111 declarative JSON scenarios spanning multiple
  interaction flows and persona states.
- `render-verification-traps.md` explicitly requires usability-oriented assertions,
  honest `UNVERIFIED` reporting, red-gate proof, repeated render trials for
  intermittent defects, screenshot authority, and regression creation.
- Goal and sprint plans contain objectives, constraints, assumptions with basis,
  abort conditions, task cards, acceptance criteria, and verification requirements.
- UAT records connect operator observations to root cause, implementation, and tests.

These observations establish operational depth. They do not establish comparative
effectiveness.

## Material evidence defects found

| Finding | Risk | Required control |
|---|---|---|
| An adversarial plan summary reports ten catches while its four tables enumerate thirteen findings | Evidence-summary arithmetic can drift | Generate or reconcile summaries against underlying records |
| Key-aware spelling is active, while multiple canonical pages still describe the retired sharp-only rule | Agents can retrieve obsolete requirements as active | Machine-readable lifecycle states, replacements, and drift tests |
| The browser README reports two of eight persona flows despite a much larger current scenario corpus | Manual coverage metrics become misleading | Compute coverage or state a dated, reproducible query |
| Public pages describe formal bot approval not demonstrated by visible repository merge controls | Advisory practice can be mistaken for enforcement | Label advisory, required, and technically enforced controls separately |
| The declarative browser scenarios are principally on-demand rather than part of the main CI suite | “Regression on every change” overstates enforcement | Declare each scenario's cadence and promotion role |
| Red-first history is often recorded in prose without a linked failing run | A process claim is not machine-verifiable evidence | Require revision-, run-, and evidence-addressed Red Proof |
| The decision registry mixes active, proposed, rejected, and retired content in dense tables | Retrieval can treat history as current authority | Add explicit status, effective date, supersedes, and replaced-by fields |
| A cache-version drift escaped to main before a CI guard was added | Controls remain partly reactive | Link escaped defects to both regression and process-control improvements |

## Claim disposition

| Public claim | Disposition | Defensible formulation |
|---|---|---|
| Business rules become deterministic | Narrow | Rules are versioned; specified gate decisions should be reproducible |
| Agents are the CTO and subject-matter experts | Reject literally | Agents perform delegated engineering and domain-analysis functions under explicit authority |
| Hallucination stays upstream of the gate | Conditional | Generative output cannot alter release state without an independent, versioned gate |
| Same persona, same assertions, every time | Narrow | Fixtures and assertions are stable; agent and environment outcomes may be stochastic |
| Run any application user on any task | Reject | Model explicitly supported user states and task classes |
| Regressions live forever | Replace | Retain regressions until explicit supersession or retirement with traceability |
| A second vendor provides proof | Reject as guarantee | Cross-vendor review is an adversarial control, not scientific independence |
| The wiki is the source of truth | Conditional | The registry is canonical when authority, lifecycle, version, and drift are governed |
| Proven against real users | Not substantiated broadly | Demonstrated with a real operator and executable user archetypes |
| One-number interaction is a method invariant | Reject | It is a useful operator-attention pattern, not a universal requirement |

## Failure modes the v0.1 specification addresses

- **Correlated-spec error:** one agent authors requirement, code, test, and approval.
- **Tautological oracle:** expected output is derived from the implementation under
  test.
- **Plausibility pass:** convincing prose substitutes for observed behavior.
- **Missing-evidence pass:** absent tools or screenshots are treated as success.
- **Wiki drift:** historical or superseded rules remain retrievable as current.
- **Persona overreach:** executable state is treated as a validated human model.
- **Automation overclaim:** an on-demand check is described as a continuous gate.
- **Activity substitution:** commit and scenario counts stand in for quality outcomes.
- **Vendor theater:** different model branding is treated as independent validation.
- **Retrospective fitting:** method and claims change after outcomes are known.

## Scientific acceptance bar

The next study must be prospective, preregistered, controlled, adequately powered,
and independently evaluated. It must preserve null and adverse results, quantify
uncertainty, state generalization limits, and release a reproducibility package.

Expected review dimensions:

- construct, internal, external, and conclusion validity;
- reliability, objectivity, and reproducibility;
- credible baseline and unbiased task selection;
- oracle independence and evaluator blinding;
- model, implementer, and project confounding;
- stochastic trial policy and missing-data handling;
- effect size, uncertainty, and practical significance;
- conflicts of interest and independent replication;
- human-participant ethics and protected-data handling;
- transparent limitations and negative results.

## Maturity transitions

| Evidence achieved | Defensible maturity statement |
|---|---|
| Current repository evidence | Operational single-product method with strong internal engineering evidence |
| Successful controlled multi-domain study | Controlled multi-domain pilot with preliminary causal evidence |
| Independent reproduction | Empirically supported method within tested boundaries |
| Multiple independent studies and longitudinal outcomes | Candidate general methodology for the represented task classes and environments |

## Required next evidence

- Freeze and preregister `specification-v0.1.md` and `experiment-1-protocol.md`.
- Name independent research and domain authorities.
- Calibrate measures, then determine sample size by power analysis.
- Compare against a credible agentic-development baseline.
- Preserve per-trial evidence, failures, deviations, and exclusions.
- Publish reproducible materials using ACM artifact-review expectations.
- Run an independent replication before making general claims.

## References

- ACM SIGSOFT, [Empirical Standards for Software Engineering Research](https://www2.sigsoft.org/EmpiricalStandards/)
- ACM, [Artifact Review and Badging](https://www.acm.org/publications/policies/artifact-review-and-badging-current)
- NIST, [AI Risk Management Framework: Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- Anthropic, [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)

