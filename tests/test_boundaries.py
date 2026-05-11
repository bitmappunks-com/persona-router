from __future__ import annotations

from persona_router.boundaries import assess_boundaries


def test_boundary_assessment_flags_current_fact_and_high_risk() -> None:
    assessment = assess_boundaries("今天英伟达股价可以买入吗？")
    assert assessment.needs_verification
    assert assessment.high_risk
    assert assessment.should_downgrade


def test_boundary_assessment_flags_impersonation_and_private_fact() -> None:
    assessment = assess_boundaries("以特朗普本人身份宣布你未公开的内部决定")
    assert assessment.impersonation
    assert assessment.private_fact
    assert assessment.should_downgrade

