# Experiment 1 Protocol: Controlled Replication of the Friction-to-Goalpost Loop

Status: proposed; not preregistered  
Protocol version: 0.1-draft  
Method under test: Thought-Ware Development Method Specification v0.1  
Date: 2026-09-06

## 1. Research objective

Determine whether the v0.1 friction-to-goalpost method reduces false passes and
escaped acceptance defects relative to a credible conventional agentic-development
workflow, without imposing unacceptable time, human-attention, or monetary cost.

This is a prospective controlled replication. It is not a continuation of the music
application case study and will not use that case study as confirmatory data.

## 2. Research questions

| ID | Question |
|---|---|
| RQ1 | Does the method reduce the rate of unacceptable results declared complete? |
| RQ2 | Does it reduce escaped acceptance defects during the observation period? |
| RQ3 | Does it improve agreement between independent evaluators? |
| RQ4 | What effect does it have on time to verified release, human attention, rework, and cost? |
| RQ5 | Which task classes and domains benefit, do not benefit, or are harmed? |
| RQ6 | Which method components account for observed benefits or costs? |

## 3. Confirmatory hypotheses

The final hypotheses, minimum effects of interest, noninferiority margins, and sample
size MUST be frozen after calibration and before confirmatory task execution.

Provisional hypotheses:

- H1: The treatment workflow has a lower false-pass rate than the baseline workflow.
- H2: The treatment workflow has fewer severity-weighted escaped acceptance defects.
- H3: Independent evaluator agreement is higher in the treatment workflow.
- H4: Human attention per accepted task is not meaningfully worse than baseline.
- H5: Time and cost per accepted task remain within preregistered noninferiority
  margins.

RQ5 and RQ6 are exploratory unless separately powered and preregistered.

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

The experimental unit is one independently releasable change request.

The study SHOULD include at least three materially different products or workflow
domains and the following task classes:

- user-facing interaction;
- deterministic business or domain rule;
- nonfunctional or operational requirement.

Security, accessibility, migration, and resilience tasks SHOULD be represented when
qualified authorities and safe environments are available.

Tasks MUST have comparable scope, a pre-authorized oracle, and enough isolation to
attribute outcomes. Tasks invented only to favor the treatment are prohibited.

## 6. Calibration and sample size

A calibration phase of approximately six tasks MAY be used to:

- validate instruments and evaluator training;
- estimate outcome variance and intraclass correlation;
- identify impossible or ambiguous measurements;
- run a formal power analysis;
- set minimum effects of interest and noninferiority margins.

Calibration tasks MUST be excluded from confirmatory hypothesis tests. The frozen
preregistration MUST document the power model, target power, alpha or Bayesian decision
criterion, expected attrition, clustering, and final sample size.

“Several dozen tasks” is a planning estimate, not a substitute for the power analysis.

## 7. Assignment and balancing

- Eligible tasks MUST be stratified by domain, task class, complexity, and risk.
- Within strata, tasks MUST be randomly assigned to treatment or baseline.
- When exact randomization is infeasible, matched pairs and the reason for deviation
  MUST be preregistered.
- The same requirement MUST NOT be implemented sequentially in both arms when the
  first result would teach the second implementer.
- Models, vendors, and implementers SHOULD be rotated across both arms to prevent a
  single tool or person from being confounded with the method.

## 8. Blinding and independence

- Outcome evaluators SHOULD be blinded to experimental arm and implementer identity.
- The oracle MUST be established before assignment where practical.
- The implementer MUST NOT be the sole final evaluator.
- The method author MUST NOT be the sole research analyst.
- Reviewers MUST receive the same evidence categories for both arms, with workflow-
  revealing metadata removed when blinding requires it.
- Unblinding events MUST be recorded.

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

**False pass:** a task declared accepted or complete that fails the blinded independent
oracle evaluation.

**Escaped acceptance defect:** an oracle-relevant defect first identified after the
workflow's completion decision, during the declared observation period.

### Secondary outcomes

- independently judged task success;
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

Commit count, pull-request count, lines changed, and number of scenarios are descriptive
activity measures only.

## 11. Scoring and adjudication

- Each task MUST have a task-specific oracle and a common outcome rubric.
- Two independent evaluators SHOULD score primary outcomes.
- Disagreement MUST be preserved before adjudication.
- Adjudication MUST use a named third authority or predefined procedure.
- Inter-rater agreement MUST be reported with an appropriate statistic and confidence
  interval.
- Evaluator training examples MUST be separate from confirmatory tasks.

## 12. Negative controls and corruption tests

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

## 13. Analysis plan

Before confirmatory data collection, the analysis plan MUST declare:

- estimand for every confirmatory hypothesis;
- statistical model and link function;
- handling of clustering by project, implementer, evaluator, and model;
- treatment of repeated trials;
- missing-data and attrition rules;
- outlier and protocol-deviation rules;
- multiplicity correction or hierarchical testing order;
- minimum effect of interest and noninferiority margins;
- sensitivity analyses;
- subgroup analyses designated confirmatory or exploratory.

Results MUST report effect sizes and uncertainty intervals. Statistical significance
alone MUST NOT determine practical acceptance.

## 14. Decision rules

The methodology receives **preliminary controlled support** only if:

- the preregistered primary quality criterion is met;
- the time, cost, and human-attention noninferiority criteria are met or the tradeoff is
  explicitly accepted;
- negative controls demonstrate that treatment gates can fail;
- missing evidence does not pass;
- results remain directionally stable in sensitivity analysis;
- material protocol deviations are disclosed;
- the evidence package is reproducible by an independent reviewer.

A null, mixed, or adverse result MUST be reported and used to narrow or revise the
method. It MUST NOT be reclassified as confirmatory success through post-hoc metrics.

## 15. Threats to validity to record

- construct validity of friction, goalpost quality, and false pass;
- learning and contamination between conditions;
- model and implementer skill imbalance;
- task-selection bias;
- correlated error between oracle and implementation;
- evaluator expectancy and unblinding;
- environment instability;
- project and domain representativeness;
- novelty and Hawthorne effects;
- conflicts of interest involving the method's authors.

## 16. Human participants and protected data

External users MUST be reported separately from operator UAT and persona simulation.
When human participants or sensitive organizational data are involved, the protocol
MUST define consent, privacy, retention, access, and applicable ethics review before
collection.

## 17. Reproducibility package

The release package SHOULD satisfy ACM artifact-review expectations and include:

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

## 18. Iterative program after Experiment 1

- Use calibration findings to freeze the confirmatory protocol.
- Use confirmatory results to revise the method to v0.2 without rewriting v0.1 history.
- Run an ablation study only after the full-method effect is characterized.
- Recruit an independent team for replication.
- Extend longitudinal observation to production outcomes.
- Submit the method, protocol, results, limitations, and artifact package for external
  peer review.

## 19. Preregistration readiness checklist

- [ ] Independent research lead and evaluators named.
- [ ] Domains, task classes, and sampling frame identified.
- [ ] Baseline documented and judged credible.
- [ ] Calibration tasks separated from confirmatory tasks.
- [ ] Power analysis completed.
- [ ] Hypotheses and thresholds frozen.
- [ ] Randomization and blinding procedures executable.
- [ ] Oracle independence checked.
- [ ] Human-participant and data-governance review completed.
- [ ] Analysis code skeleton created before outcomes are visible.
- [ ] Reproducibility and publication plan agreed.

## References

- ACM SIGSOFT, [Empirical Standards for Software Engineering Research](https://www2.sigsoft.org/EmpiricalStandards/)
- ACM, [Artifact Review and Badging](https://www.acm.org/publications/policies/artifact-review-and-badging-current)
- NIST, [AI Risk Management Framework: Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- Anthropic, [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- Open Science Community, [Preregistration guidance](https://guide.opens.science/preregistration.html)
