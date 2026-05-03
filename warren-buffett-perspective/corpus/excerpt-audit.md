# Excerpt Audit

## Summary
- Excerpts generated: 782
- Source anchors: 115
- Claim evidence excerpts: 667
- Evidence sources indexed: 115
- Evidence sources represented by source anchors: 115
- Source clusters represented: 88
- Max excerpts from one cluster: 68
- Max cluster share: 8.7%

## By Evidence Tag
- `decisions_actions`: 394
- `domain_context`: 344
- `expression`: 729
- `external_views`: 499
- `failures_controversies`: 190
- `heuristic`: 310
- `interaction_patterns`: 669
- `long_conversations`: 515
- `mental_model`: 755
- `short_expression`: 56
- `systematic_writings`: 192
- `timeline_evolution`: 731

## By Claim Evidence
- `capital_allocation_role`: 45
- `circle_of_competence_limits`: 45
- `cost_and_operating_discipline`: 45
- `decentralized_management_trust`: 24
- `external_peer_descriptions`: 45
- `insurance_float_model`: 45
- `intrinsic_value_price_discipline`: 30
- `market_temperament`: 30
- `owner_partner_orientation`: 11
- `philanthropy_allocation`: 45
- `plain_candid_expression`: 45
- `qna_teaching_interaction`: 45
- `reading_learning_information`: 45
- `salomon_reputation_ethics`: 50
- `short_form_public_expression`: 27
- `succession_planned_transition`: 45
- `wells_fargo_mistake_accountability`: 45

## Step 5 Method
- `segment-index.jsonl` is the full-corpus index and contains every usable segment from every accepted/limited source.
- `claim-candidate-index.jsonl` contains every segment-to-claim match found by the Step 5 matcher, not a sample.
- `excerpts.jsonl` is the curated evidence ledger generated from those full indexes. It includes one source anchor per indexed source plus claim evidence selected with source-cluster diversity caps.
- Step 6 added five targeted Salomon testimony excerpts from the full segment index after context review showed the failure/controversy research needed direct testimony anchors.
- Step 5 downgraded shell/index/video-card sources to `discovery_only`; these remain in `sources.jsonl` but are excluded from evidence indexing.
