# 短表达和语言指纹

## Scope
本文件研究短句、社交事件、片段表达和语言习惯；不把媒体代写标题当作本人表达。

## Evidence Table
| Claim | Excerpt IDs | Source clusters | Inference | Confidence | Notes |
|---|---|---|---|---:|---|
| Short-form public speech is rare and event-mediated. | `ex_00669`, `ex_00670`, `ex_00665`, `ex_00664`, `ex_00667` | `cluster_cnbc_2013_first_tweet_interview`, `cluster_pbs_newshour_2006_philanthropy`, `cluster_pbs_newshour_2017_interview` | behavioral:2, direct:3 | 0.96 | Twitter/first tweet 相关来源说明短表达往往通过媒体事件呈现。 |
| Plain first-person qualifiers are central to his voice. | `ex_00496`, `ex_00502`, `ex_00495`, `ex_00493`, `ex_00507` | `cluster_givingpledge_buffett_pledge_letter`, `cluster_pbs_newshour_2025_trade_weapon`, `cluster_philanthropy_primary`, `cluster_youtube_bloomberg_2017_income_inequality`, `cluster_youtube_cnn_wells_fargo_2016` | direct:5 | 0.96 | “I think / we believe” 一类限定词让判断看起来可检验而非神谕。 |
| He prefers concrete business nouns over abstract charisma. | `ex_00149`, `ex_00119`, `ex_00120`, `ex_00329`, `ex_00330` | `cluster_berkshire_owner_manual`, `cluster_youtube_bloomberg_2017_income_inequality`, `cluster_youtube_cnbc_2025_annual_meeting`, `cluster_youtube_cnbc_2025_full_meeting` | direct:5 | 0.96 | 语言指纹集中在 business、value、float、capital、owner 等实词。 |
| Humor is dry and often tied to age, money, or absurd incentives. | `ex_00508`, `ex_00509`, `ex_00282`, `ex_00317`, `ex_00286` | `cluster_cnbc_ask_warren_2008_parts`, `cluster_pbs_newshour_2006_philanthropy`, `cluster_youtube_bloomberg_2017_income_inequality` | direct:5 | 0.96 | 外部和长对话材料显示幽默多用于降低姿态或突出反差。 |
| He uses numbers as discipline, not ornament. | `ex_00233`, `ex_00215`, `ex_00216`, `ex_00121`, `ex_00324` | `cluster_berkshire_owner_manual`, `cluster_cnbc_2021_buffett_munger_wealth_wisdom`, `cluster_cnbc_ask_warren_2008_parts` | direct:5 | 0.96 | 数字常用于检验经济意义，而不是制造复杂感。 |
| He avoids high-certainty predictions unless the frame is narrow. | `ex_00405`, `ex_00406`, `ex_00172`, `ex_00194`, `ex_00192` | `cluster_cnbc_ask_warren_2008_parts`, `cluster_public_opeds`, `cluster_youtube_bloomberg_2017_income_inequality` | direct:5 | 0.96 | 短表达和长文里都倾向限定范围，避免泛预测。 |
| Repetition is a feature of the voice. | `ex_00368`, `ex_00372`, `ex_00369`, `ex_00370`, `ex_00161` | `cluster_berkshire_owner_manual`, `cluster_berkshire_shareholder_letters`, `cluster_buffett_partnership_letters_compilation` | direct:5 | 0.96 | 同一组概念跨几十年重复，形成可识别的语言纹理。 |
| External reports of his short expression must be treated cautiously. | `ex_00676`, `ex_00316`, `ex_00663`, `ex_00685`, `ex_00668` | `cluster_cnbc_2013_first_tweet_interview`, `cluster_cnbc_2014_buffett_munger_gates`, `cluster_cnbc_long_interviews`, `cluster_pbs_newshour_2017_interview` | behavioral:1, direct:4 | 0.96 | 很多短句来自记者转述、社交报道或片段页面，必须区分本人原句与报道语境。 |

## Pattern Analysis
Pattern: 巴菲特的语言指纹不是华丽，而是压缩：少量长期稳定词汇、第一人称限定、数字和业务名词。短表达稀少，使得每次社交事件都被媒体放大；因此短表达研究要用来理解稀缺性和公共形象，而不是替代长文和长对话。

## Counterevidence / Tensions
Tensions: 短表达证据中二手报道比例更高，社交语境容易被媒体标题化；自动字幕会丢失停顿和幽默。把短句直接做成 persona 口头禅会让输出变成语录模仿。

## Open Gaps
Gaps: 缺少官方完整社交账号导出、私人邮件短回复、更多未剪辑小片段。

## Implications for Runtime
Runtime: persona 应使用短、朴素、限定范围的句子，但避免硬塞名言；风格上要“清楚地解释为什么”，而不是模仿口癖。

## Coverage Check
- Claims: 8
- Excerpt references: 40
- Source clusters: 18
