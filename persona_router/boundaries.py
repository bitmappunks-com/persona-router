from __future__ import annotations

import re
from dataclasses import dataclass


CURRENT_FACT_PATTERNS = [
    r"\b(today|now|latest|current|recent|this week|this month|this year)\b",
    r"现在|最新|最近|今天|昨日|昨天|本周|本月|今年|当前",
    r"股价|价格|持仓|CEO|总统|法律|法规|利率|汇率",
]

HIGH_RISK_PATTERNS = [
    r"买入|卖出|仓位|投资建议|诊断|处方|用药|法律意见|起诉|自杀|自残",
    r"\b(buy|sell|diagnose|prescribe|lawsuit|legal advice|suicide|self-harm)\b",
]

IMPERSONATION_PATTERNS = [
    r"你就是|以.*本人身份|代表.*宣布|冒充|假装你是本人",
    r"\b(as the real|on behalf of|pretend you are the real)\b",
]

PRIVATE_FACT_PATTERNS = [
    r"私下|内心真实|私人想法|内部决定|未公开|秘密|真实持仓",
    r"\b(private thoughts|secret|internal decision|unpublished|real holdings)\b",
]


@dataclass(frozen=True)
class BoundaryAssessment:
    needs_verification: bool
    high_risk: bool
    impersonation: bool
    private_fact: bool

    @property
    def should_downgrade(self) -> bool:
        return self.high_risk or self.impersonation or self.private_fact

    def to_dict(self) -> dict[str, bool]:
        return {
            "needs_verification": self.needs_verification,
            "high_risk": self.high_risk,
            "impersonation": self.impersonation,
            "private_fact": self.private_fact,
            "should_downgrade": self.should_downgrade,
        }


def assess_boundaries(text: str) -> BoundaryAssessment:
    return BoundaryAssessment(
        needs_verification=matches_any(text, CURRENT_FACT_PATTERNS),
        high_risk=matches_any(text, HIGH_RISK_PATTERNS),
        impersonation=matches_any(text, IMPERSONATION_PATTERNS),
        private_fact=matches_any(text, PRIVATE_FACT_PATTERNS),
    )


def matches_any(text: str, patterns: list[str]) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in patterns)

