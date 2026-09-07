# Experiment 1 Protocol: Controlled Evaluation of the Friction-to-Goalpost Loop

Status: proposed; not preregistered
Protocol version: 0.1.1-draft
Method under test: Thought-Ware Development Method Specification v0.1
Date: 2026-09-07

## 1. Research objective

Determine whether the v0.1 friction-to-goalpost method reduces unacceptable
completions while preserving independently verified task success relative to a
credible conventional agentic-development workflow, without exceeding preregistered
time, human-attention, or monetary-cost margins.

This is a prospective controlled evaluation, not a replication. It is not a
continuation of the music application case study and will not use that case study as
confirmatory data. “Replication” is reserved for a later independent execution of the
frozen study.

## 2. Research questions

| ID | Question |
|---|---|
| RQ1 | Does the method reduce unacceptable-completion incidence per assigned task? |
| RQ2 | Does it reduce escaped acceptance defects during the observation period? |
| RQ3 | Does it preserve or improve independently verified task success? |
| RQ4 | What effect does it have on time to verified release, human attention, rework, and cost? |
| RQ5 | Does the evidence package improve agreement between independent evaluators? |
| RQ6 | Which task classes and domains benefit, do not benefit, or are harmed? |
| RQ7 | Which method components account for observed benefits or costs? |

## 3. Confirmatory hypotheses

The final hypotheses, minimum effects of interest, noninferiority margins, and sample
size MUST be frozen after calibration and before confirmatory task execution.

Provisional hypotheses:

- H1: The treatment workflow has lower unacceptable-completion incidence per assigned
  task than the baseline workflow.
- H2: Independently verified task success per assigned task is not inferior to the
  baseline workflow by more than the preregistered margin.
- H3: The treatment workflow has fewer severity-weighted escaped acceptance defects
  during an equal observation window, if calibration supports adequate power.
- H4: Human attention per assigned task is not meaningfully worse than baseline.
- H5: Time and cost per assigned task remain within preregistered noninferiority
  margins.

Evaluator agreement, domain subgroups, and component attribution are exploratory
unless separately powered and preregistered.

## 4. Experimental conditions

### Treatment

The treatment arm MUST conform to `specification-v0.1.md` at the Controlled profile.
It uses the required templates, role separation, Red Proof, declared grader classes,
fail-closed outcomes, Evidence Bundle, and lifecycle controls.

### Baseline

The baseline MUST be a documented, credible agentic-development workflow that a
competent team would otherwise use. It MUST include ordinary requirements, code
review, and existing CI. It MUST NOT be intentionally weakened or deprived of tools
normally available to the team.

The baseline MAY use agents and tests. The contrast is the complete governed
friction-to-goalpost method, not “agents versus no agents” or “testing versus no
testing.”

## 5. Experimental units and sampling

The allocation unit is one eligible, independently evaluable change request. The unit
of inference is the assigned change request; repeated model runs or evaluator scores
are measurements nested within it and MUST NOT be counted as independent task units.

Before assignment, the research lead MUST freeze the eligible-task sampling frame,
inclusion and exclusion rules, task-complexity rubric, and oracle-readiness check.
Recruitment, exclusion, and arm-specific attrition counts MUST be reported in a task
flow diagram or table.

The study SHOULD include at least three materially different products or workflow
domains and the following task classes:

- user-facing interaction;
- deterministic business or domain rule;
- nonfunctional or operational requirement.

Security, accessibility, migration, and resilience tasks SHOULD be represented when
qualified authorities and safe environments are available.

Tasks MUST have comparable scope, a pre-authorized oracle, and enough isolation to
attribute outcomes. Tasks invented only to favor the treatment are prohibited. The
protocol MUST state whether the primary design uses real change requests, matched
task pairs, or parallel isolated implementations of common benchmark tasks. Results
from these designs MUST NOT be pooled without a preregistered hierarchical model.

## 6. Calibration and sample size

A calibration phase of six matched task pairs, twelve allocation units, MAY be used
as specified in `experiment-1-calibration-runbook.md` to:

- validate instruments and evaluator training;
- estimate outcome variance and intraclass correlation;
- identify impossible or ambiguous measurements;
- run a formal power analysis;
- set minimum effects of interest and noninferiority margins.

Calibration tasks MUST be excluded from confirmatory hypothesis tests and unavailable
to confirmatory implementers except for generic training material disclosed in both
arms. The frozen preregistration MUST document the power model, target power, alpha or
Bayesian decision criterion, expected attrition, clustering, final sample size, and
simulation or code used to justify the design.

“Several dozen tasks” is a planning estimate, not a substitute for the power analysis.

## 7. Assignment and balancing

- Eligible tasks MUST be stratified by domain, task class, complexity, and risk.
- Within strata, tasks MUST be randomly assigned to treatment or baseline.
- The allocation sequence MUST be generated reproducibly and concealed from task
  selectors until eligibility and oracle readiness are locked.
- When exact randomization is infeasible, matched pairs and the reason for deviation
  MUST be preregistered.
- The same requirement MUST NOT be implemented sequentially in both arms when the
  first result would teach the second implementer.
- Models, vendors, and implementers SHOULD be rotated across both arms to prevent a
  single tool or person from being confounded with the method.
- Every randomized unit MUST remain in the primary intention-to-treat analysis. A
  unit that is abandoned, blocked, or never accepted is an outcome, not silent
  attrition.

## 8. Blinding and independence

- Outcome evaluators MUST be blinded to experimental arm and implementer identity for
  primary outcomes unless blinding is demonstrably impossible and the exception and
  bias-control analysis are preregistered.
- The oracle MUST be established before assignment; a task without an oracle-ready
  determination is ineligible for confirmatory allocation.
- The implementer MUST NOT be the sole final evaluator.
- The method author MUST NOT be the sole research analyst.
- Reviewers MUST receive the same evidence categories for both arms, with workflow-
  revealing metadata removed when blinding requires it.
- Unblinding events MUST be recorded.
- The independent research lead MUST disclose authorship, employment, funding,
  financial interest, and other material conflicts. Independence claims MUST state
  the criteria actually met rather than relying on different model or vendor names.

## 9. Agent configuration and stochasticity

For every agent-assisted trial, record:

- provider and model identifier;
- model version or date where available;
- system and task instructions;
- tool availability and permissions;
- temperature or equivalent sampling controls where exposed;
- context sources;
- retry and stopping policy;
- token use, elapsed time, and cost where measurable.

Stochastic tasks MUST use a preregistered number of independent trials. Per-trial
results MUST be retained. Selectively rerunning failures or reporting only the best
candidate is prohibited unless best-of-k is itself the preregistered policy.

## 10. Outcome definitions

### Primary outcomes

**Unacceptable-completion incidence:** number of assigned tasks declared accepted or
complete that fail the blinded independent oracle evaluation, divided by all assigned
tasks in the arm.

**Independently verified task success:** number of assigned tasks satisfying the
blinded independent oracle, divided by all assigned tasks in the arm. Tasks not
completed within the preregistered stopping rule remain in the denominator.

Both outcomes are required: unacceptable completion alone can be improved by refusing
to complete work.

**Escaped acceptance defect:** an oracle-relevant defect first identified after the
workflow's completion decision, during an equal, preregistered observation period.

### Secondary outcomes

- false pass among declared completions, reported as a diagnostic conditional rate;
- severity-weighted defect count;
- evaluator agreement;
- time to verified release;
- human attention minutes;
- implementation and evaluation cost;
- rework count and duration;
- evidence completeness;
- specification-drift incidence;
- rollback or incident count;
- participant task success and usability measures where human studies are included.

Every rate MUST report numerator, denominator, unit, observation window, missing-data
handling, and interval estimate. Severity weights and defect adjudication rules MUST
be frozen before confirmatory outcomes are visible.

Commit count, pull-request count, lines changed, and number of scenarios are descriptive
activity measures only.

## 11. Scoring and adjudication

- Each task MUST have a task-specific oracle and a common outcome rubric.
- Two independent evaluators MUST score primary outcomes unless calibration shows a
  deterministic oracle with verified perfect reproducibility; any exception MUST be
  preregistered.
- Disagreement MUST be preserved before adjudication.
- Adjudication MUST use a named third authority or predefined procedure.
- Inter-rater agreement MUST be reported with an appropriate statistic and confidence
  interval.
- Evaluator training examples MUST be separate from confirmatory tasks.

## 12. Treatment fidelity and contamination

- A blinded process auditor MUST score treatment conformance from a frozen checklist.
- Baseline teams MUST receive their documented normal workflow and MUST NOT be denied
  ordinary quality controls.
- Treatment-specific artifacts or coaching MUST NOT enter the baseline arm after
  assignment.
- Fidelity failures and cross-arm contamination MUST be retained, reported, and
  addressed in sensitivity analyses; they MUST NOT be silently excluded.
- A per-protocol analysis MAY supplement but MUST NOT replace intention-to-treat.

## 13. Negative controls and corruption tests

The protocol MUST include controlled cases that should fail, such as:

- plausible explanation paired with incorrect behavior;
- a passing test that verifies the wrong outcome;
- a stale or superseded rule;
- missing or mismatched evidence;
- an acceptance criterion derived from the candidate implementation;
- local success with a known regression elsewhere;
- a visually attractive result that blocks the declared user goal.

The study MUST report whether each arm detects these cases. Infrastructure failures are
not successful negative controls.

## 14. Analysis plan

Before confirmatory data collection, the analysis plan MUST declare:

- estimand for every confirmatory hypothesis;
- intention-to-treat population and unit of analysis;
- statistical model and link function;
- handling of clustering by project, implementer, evaluator, and model;
- treatment of repeated trials;
- missing-data and attrition rules;
- outlier and protocol-deviation rules;
- multiplicity correction or hierarchical testing order;
- minimum effect of interest and noninferiority margins;
- sensitivity analyses;
- subgroup analyses designated confirmatory or exploratory.

The analysis MUST report arm-level assigned, completed, accepted, independently
successful, blocked, and missing counts. It MUST test whether any quality improvement
is explained by lower completion or acceptance. Confirmatory code MUST be written
against schema-valid synthetic data before arm labels and outcomes are released to
the analyst.

Results MUST report effect sizes and uncertainty intervals. Statistical significance
alone MUST NOT determine practical acceptance.

## 15. Decision rules

The methodology receives **preliminary controlled support** only if:

- the preregistered primary quality criterion is met;
- independently verified task success, time, cost, and human-attention criteria meet
  their preregistered superiority or noninferiority rules;
- negative controls demonstrate that treatment gates can fail;
- missing evidence does not pass;
- no preregistered, plausible sensitivity analysis reverses the primary decision;
- material protocol deviations are disclosed;
- the evidence package permits an independent reviewer to reproduce the reported
  tables, figures, and statistics from frozen raw data.

A quality benefit that fails a cost or success noninferiority rule MAY be reported as
a tradeoff finding but MUST NOT receive “preliminary controlled support.”

A null, mixed, or adverse result MUST be reported and used to narrow or revise the
method. It MUST NOT be reclassified as confirmatory success through post-hoc metrics.

## 16. Threats to validity to record

- construct validity of friction, goalpost quality, and false pass;
- learning and contamination between conditions;
- model and implementer skill imbalance;
- task-selection bias;
- correlated error between oracle and implementation;
- evaluator expectancy and unblinding;
- environment instability;
- project and domain representativeness;
- novelty and Hawthorne effects;
- conflicts of interest involving the method's authors;
- outcome gaming through noncompletion, abstention, or delayed acceptance;
- allocation leakage and differential attrition;
- treatment-fidelity failure and baseline contamination.

## 17. Human participants and protected data

External users MUST be reported separately from operator UAT and persona simulation.
When human participants or sensitive organizational data are involved, the protocol
MUST define consent, privacy, retention, access, and obtain and record the applicable
ethics or institutional-review determination before collection.

## 18. Reproducibility package

Any report claiming preliminary controlled support MUST release a package aligned to
ACM artifact-review expectations and include:

- frozen method and protocol versions;
- preregistration and amendments;
- task sampling and randomization code;
- de-identified task materials and oracle records;
- agent prompts and configurations;
- fixtures, graders, and execution harness;
- raw per-trial results;
- analysis code and environment lock;
- generated tables and figures;
- protocol deviations and excluded data;
- replication instructions and licensing;
- a provenance manifest with content hashes.

When materials cannot be shared, the package MUST identify what is withheld, why, and
what substitute evidence permits independent assessment.

Computational reproducibility of the original analysis MUST be described separately
from independent replication of the study.

## 19. Iterative program after Experiment 1

- Use calibration findings to freeze the confirmatory protocol.
- Use confirmatory results to revise the method to v0.2 without rewriting v0.1 history.
- Run an ablation study only after the full-method effect is characterized.
- Recruit an independent team for replication.
- Extend longitudinal observation to production outcomes.
- Submit the method, protocol, results, limitations, and artifact package for external
  peer review.

## 20. Preregistration readiness checklist

- [ ] Independent research lead and evaluators named.
- [ ] Domains, task classes, and sampling frame identified.
- [ ] Allocation unit, inference unit, flow reporting, and primary design identified.
- [ ] Baseline documented and judged credible.
- [ ] Calibration tasks separated from confirmatory tasks.
- [ ] Power analysis completed.
- [ ] Hypotheses and thresholds frozen.
- [ ] Randomization and blinding procedures executable.
- [ ] Allocation concealment and intention-to-treat rules executable.
- [ ] Oracle independence checked.
- [ ] Human-participant and data-governance review completed.
- [ ] Analysis code skeleton created before outcomes are visible.
- [ ] Treatment-fidelity and contamination checks frozen.
- [ ] Reproducibility and publication plan agreed.

## References

- ACM SIGSOFT, [Empirical Standards for Software Engineering Research](https://www2.sigsoft.org/EmpiricalStandards/)
- ACM, [Artifact Review and Badging](https://www.acm.org/publications/policies/artifact-review-and-badging-current)
- NIST, [AI Risk Management Framework: Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- Anthropic, [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- Center for Open Science, [Preregistration](https://www.cos.io/initiatives/prereg)
