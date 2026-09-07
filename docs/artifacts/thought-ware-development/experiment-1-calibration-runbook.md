# Experiment 1 Calibration Runbook

Status: proposed feasibility run; not confirmatory evidence
Date: 2026-09-07
Protocol: `experiment-1-controlled-evaluation-protocol.md` draft 0.1.1

## Purpose

Prove that the study can allocate work fairly, preserve blinding, measure outcomes,
audit treatment fidelity, and reproduce an analysis before choosing a confirmatory
sample size. Calibration results MUST NOT be used to claim that the method is better.

## Smallest informative design

- Select three materially different software or workflow domains.
- Prepare two matched benchmark task pairs per domain: one user-facing or interaction
  pair and one domain-rule or operational pair.
- Each pair contains two independently executable variants matched before allocation
  for complexity, risk, oracle structure, and expected effort.
- Randomly assign one variant in each pair to the treatment and the other to the
  baseline, producing twelve allocation units: six treatment and six baseline.
- Execute variants in isolated environments. Implementers MUST NOT see the paired
  variant, the other arm's artifacts, or evaluator outcomes.
- Rotate at least two implementers or agent configurations across both arms so arm and
  implementer are not identical.

This design calibrates instruments and variance. Twelve units are not assumed to be
powered for comparative-effectiveness claims.

## Before allocation

The independent research lead freezes:

1. task-pool inclusion and exclusion rules;
2. pair matching and risk ratings;
3. task-specific oracles and unacceptable outcomes;
4. common evaluator rubric and severity weights;
5. ordinary baseline workflow and allowed tools;
6. treatment conformance checklist;
7. time, cost, attention, retry, and stopping definitions;
8. de-identified evidence-packet format;
9. allocation script and concealed seed;
10. synthetic analysis dataset and expected analysis outputs.

Task selectors sign the eligible pool before the allocation sequence is revealed.

## Execution sequence

| Stage | Accountable role | Required output |
|---|---|---|
| Eligibility | Research lead and domain authority | Frozen twelve-unit pool and oracle-readiness record |
| Allocation | Independent allocator | Reproducible assignment file and concealed seed |
| Implementation | Rotated implementers | Candidate, timestamps, cost, attention, retries, and arm artifacts |
| Fidelity audit | Process auditor | Treatment conformance and baseline-integrity scores |
| Outcome scoring | Two blinded evaluators | Independent per-unit scores before adjudication |
| Adjudication | Named third authority | Preserved disagreement and final oracle decision |
| Analysis rehearsal | Independent analyst | Tables and figures reproduced from frozen unit-level data |
| Calibration decision | Research lead | Revise, repeat calibration, or freeze confirmatory protocol |

## Instrument checks

The calibration succeeds only when:

- all twelve assigned units appear in the task flow and analysis dataset;
- every task has a pre-allocation oracle and risk classification;
- every treatment unit has a clause-level conformance assessment;
- baseline units receive the documented ordinary workflow and tool access;
- arm-identifying metadata is absent from blinded evaluator packets;
- primary-outcome double scoring is complete before adjudication;
- time, cost, attention, completion, acceptance, and success denominators reconcile;
- negative controls establish that missing or invalid treatment evidence cannot pass;
- the independent analyst reproduces all reported tables and figures from the frozen
  dataset and analysis environment;
- protocol deviations, contamination, unblinding, and missing data are visible rather
  than silently corrected.

Inter-rater agreement, outcome variance, intraclass correlation, task duration, and
attrition are estimates used to refine instruments and simulate confirmatory sample
size. Thresholds for acceptable reliability MUST be set before calibration scores are
revealed; failed thresholds trigger revision or another calibration run.

## Allowed conclusions

Calibration MAY establish that the protocol, instruments, and analysis pipeline are
feasible or identify how they fail. It MUST NOT establish comparative effectiveness,
causality, generalizability, `Evaluated` conformance, or independent replication.

## Required handoff to confirmatory study

- frozen protocol and amendment log;
- task-flow and allocation records;
- calibration-only dataset, clearly excluded from confirmation;
- instrument reliability and missingness results;
- treatment-fidelity and baseline-integrity findings;
- simulation-backed power analysis;
- final estimands, margins, models, multiplicity rules, and sample size;
- preregistration URL or immutable receipt;
- independent analysis and reproducibility plan.
