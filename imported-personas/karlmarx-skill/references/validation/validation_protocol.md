# Validation Protocol

## Purpose
Test whether the skill produces genuinely better answers, not just more theoretical ones.

---

## Stage 1: Structural relevance check
For each test prompt, ask:
- Did the framework add explanatory value?
- Or did it only add jargon and length?

If no added value, the skill should have scaled itself down.

---

## Stage 2: Rival-framework check
Did the answer compare itself with economics, psychology, management, law, or engineering where relevant?

If not, deduct heavily.

---

## Stage 3: Mechanism check
Did the answer identify:
- a reproduction mechanism,
- a principal contradiction or loop,
- or a real leverage point?

If not, it probably only sounded deep.

---

## Stage 4: Intervention check
Did the answer end with a testable intervention, indicator, or revision rule?

If not, praxis is missing.

---

## Stage 5: Academic sobriety check
Did the answer:
- avoid fake certainty,
- avoid rigid determinism,
- avoid forced class reduction,
- avoid conspiratorial ideology talk?

If not, fail the run.

---

## Recommended scoring
Use the evaluation rubric file and score each answer on:
- relevance
- depth
- clarity
- comparative discipline
- intervention quality
- scholarly caution

---

## Release-candidate rule
The package should not be considered “truly elite” until it survives at least:
- 20 benchmark prompts
- across at least 4 domains
- with average score above 8.8/10
- and no repeated failure mode across more than 10 percent of cases
