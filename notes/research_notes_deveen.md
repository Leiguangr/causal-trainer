First batch:

Most frequent fix needed: scenarios mention a clear Z, but variables only includes X and Y, creates “unused/missing variable” inconsistencies.


Overconfident YES labels: many YES cases rely on “no other changes occurred” without specifying what was checked (reads like handwaving).


Market-mechanics realism drift: several claims imply a single trader/analyst action moved market prices; these tend to become AMBIG/NO unless explicitly framed as an actual market-wide intervention or randomized test.

Second batch (L1):

Trends / Patterns Observed
L1 vs L2 leakage: Many “AMBIGUOUS/NO” judgments are driven by missing timing/causal attribution. That’s usually L2+. At L1, the bar is: does the scenario credibly report an observational association, not whether causality is identified.
Over-triggering AMBIGUOUS from “Z exists”: The mere presence of a third variable (Z) shouldn’t force ambiguity at L1 unless the claim is explicitly conditional on Z or Z affects who enters the dataset (selection/filters).
Base-rate + regression used too aggressively: Base-rate neglect and regression-to-mean often weaken predictive usefulness/generalization, but don’t necessarily invalidate an observed association (“X is associated with Y”) unless the association is an artifact of extreme-group selection.
Collider overuse / weak plausibility: Conditioning on “listed on major exchanges” or “Series B funded” is often better framed as selection/survivorship unless it’s clearly plausible that both X and Y cause Z (true collider).
Topic clustering (crypto): Many scenarios reuse the same motif (stablecoin supply ↔ exchange inflows ↔ BTC price/volume ↔ active addresses ↔ miner selling ↔ volatility), creating redundancy even when trap labels differ.
Claim–scenario mismatch (too broad): Vague claims like “X is associated with price movements” are hard to validate; tighter claims (“X increases when Y decreases over 6 months”) reduce ambiguity and improve consistency.
Best-performing L1 YES pattern: Clear observational framing + defined window + direction/magnitude (e.g., “over 6 months, X +25%, Y +40%”) + no conditioning on a biased sample.
Most reliable L1 NO pattern: Explicit selection/attrition/survivorship where excluded units plausibly differ on outcomes (delistings, dropouts, only active accounts), making the reported association non-representative.
Trends / Patterns Observed (Validated L2 Batch)
Overall: The batch is highly concentrated in central-bank bond purchase / QE scenarios, which increases topical redundancy and naturally yields many YES labels because the underlying mechanism (bond demand ↑ → price ↑ → yield ↓) is canonical and repeatedly invoked.
YES pattern: Strong YES cases consistently include intervention language (purchased/initiated/executed/targeted) plus identification cues (no other major events, other factors held constant, stable inflation/fiscal policy). Causal structure is usually simple (X → Y), sometimes with an extra downstream effect (X → Z like liquidity/spreads/confidence).
AMBIGUOUS pattern: Ambiguous cases are mostly timing/attribution ambiguities triggered by phrases like “during the same period” or “around the same time” plus a competing driver (inflation expectations, ratings, concurrent purchases). These are typically fixable by adding one clarifying sentence specifying event ordering or relative magnitude.
NO pattern: The best NO cases explicitly instantiate a known causal failure mode: confounding (common shock/announcement affects X and Y), collider/selection (conditioning on “only IG funds” / “only survivors”), feedback loops (expectations adjust and then affect outcomes), mediator-adjustment errors (“controlled for Z” where Z lies on X → Z → Y), and Goodhart (targeting a proxy degrades the true objective).
Common labeling issues: TrapType = NONE appears even when Z implicitly introduces alternative explanations; several “needs refining” cases lack clarity on whether Z is confounder vs mediator vs collider vs downstream outcome, which weakens the ground-truth justification.
Fast heuristics (cue words):
YES: purchased / initiated program / held constant / no other events / stable conditions
AMBIGUOUS: during the same period / around the same time / concurrently + another plausible driver
NO: announcement/stimulus (confounding), only included/only considered (selection/collider), expectations adjusted (feedback), controlled for (mediator error), rewarded/incentivized (Goodhart)
Next-batch improvements: Increase topic diversity beyond QE (e.g., FX, repo/funding stress, CDS basis, EM sovereign spreads, issuance supply) and make “NO” cases self-contained by explicitly stating the selection/common-shock/loop rather than relying on implied structure.
Trends / Patterns Observed (This L1 Batch)
Topic clustering: Heavy concentration in corporate actions + earnings (dividends, buybacks, earnings surprises), with one macro/policy outlier (EV policy). This creates repeated templates and makes YES cases easy to generate.


YES pattern: Most valid YES examples use clean observational phrasing + explicit numeric pattern (“X often followed by Y”, “15% average increase”, “across sectors”) and avoid conditioning on a selected subset.


AMBIGUOUS pattern: Ambiguity is consistently triggered by two simultaneous plausible drivers (e.g., buyback + acquisition rumors; product launch + competitor recall) and missing event ordering (“timing unknown”).


NO pattern (when done well): Strong NOs here are primarily survivorship/selection and Simpson’s paradox, where the scenario explicitly says “excluded failures / only survivors” or “within groups the relationship reverses.”


Common error mode: Several samples mark CONFOUNDING / REVERSE / REGRESSION / BASE_RATE as NO even though the claim is purely “associated with”. These traps usually invalidate causal or predictive/generalizable claims, not the existence of an association in the described data.


Field consistency issues: A few entries have misaligned variable definitions vs the claim (notably the Goodhart case) or invalid causalStructure syntax. These are easy fixes but currently make the entries fail “dataset quality” checks.
L3 Pattern Notes (from these examples)
- Many generated L3 items “sound counterfactual” (use “had X not occurred…”) but omit an explicit counterfactual identification setup (RCT/DiD/RD/IV/synth control/SCM assumptions). Under the L3 rubric, this makes the claim hard to annotate as YES/NO/AMBIGUOUS because the validity of the counterfactual approach is unspecified.
- “NO” justifications often rely on a named trap (Feedback, Mediator Fixing) without tying it to a concrete violated assumption/check (e.g., stable dynamics, SUTVA/no interference, correct mediator handling, exclusion restriction).
- Mediator cases frequently suffer from causal-structure mismatch: the scenario describes X and Z as concurrent decisions, while the metadata asserts X → Z → Y. Aligning the story with the DAG (or updating the DAG/trap) is necessary for defensible labeling.
- Quick repair strategy: add one sentence stating the counterfactual method and its key assumptions; then, for NO/AMBIGUOUS, explicitly name which assumption/check fails (e.g., feedback breaks stability; mediator is improperly held fixed; pre-trends missing; exclusion restriction unclear).
Trends / Patterns (L3-specific)
- Most AMBIGUOUS cases are strongest when they (1) state a counterfactual method (DiD/matching/SCM) and (2) point to one missing identification assumption (parallel trends, comparability, timing).
- Many YES cases over-rely on “model validated with high accuracy” + “assumes no confounders.” Predictive accuracy is not enough for L3; add explicit causal identification (shock exogeneity, instruments, falsification tests, robustness checks, or an SCM with justified invariances).
- A recurring failure mode is internal inconsistency (variable symbols reused, swapped X/Y meanings, or scenario contradicting the explanation). These become non-annotatable quickly—tight variable hygiene is critical.
Example:


Second example: Z is used for 2 different things
- Trap labeling drifts in several NO cases: common-cause confounding is repeatedly mislabeled as REVERSE. If Z drives both X and Y, default to CONFOUNDING unless you explicitly justify an outcome-dependent worlds / reverse-causation structure.

L3 Prompt Summary
For Pearl Level L3 (counterfactual) items, I instructed the generator to produce self-contained scenarios where the claim is explicitly counterfactual (e.g., “had X not occurred, Y would have…”). Each scenario must explicitly state a valid counterfactual identification approach (RCT, DiD with pre-trend checks, RD with no manipulation, IV with relevance/exclusion, synthetic control, or an SCM with stated assumptions). “YES” cases require at least two defensibility anchors (assignment rule + validation checks like placebo/pre-trends/robustness). “AMBIGUOUS” cases must still describe an attempted counterfactual method but be missing one key identification assumption/check; they must include a hiddenTimestamp question and two conditionalAnswers branches that resolve the ambiguity. “NO” cases must contain a clear causal failure (e.g., bad controls/post-treatment adjustment, bad instrument, interference/spillovers, anticipation, selection/collider bias, or unstated/contradicted model assumptions). Any domain knowledge needed to evaluate the counterfactual must be explicitly included as assumptions inside the scenario (no reliance on external world knowledge).


L2 Prompt Summary
For Pearl Level L2 (interventional) items, I instructed the generator to produce scenarios framed as “do(X)” claims (“doing X changes Y”), not merely correlations. “YES” cases are primarily allowed when the scenario explicitly describes an RCT (random assignment + control) or a defensible quasi-experiment (e.g., DiD with explicit parallel-trends evidence, RD with a clear cutoff and no manipulation, IV with relevance + plausible exclusion restriction, natural experiment/policy shock with a credible comparison group). Each YES scenario includes at least two defensibility anchors (assignment rule plus checks such as balance/placebo/pre-trends/robustness/no concurrent shocks). “AMBIGUOUS” cases must include an attempted causal design but omit a single decisive identification detail (e.g., parallel trends not assessed, cutoff manipulation possible, spillovers, exclusion restriction unclear) and therefore include hiddenTimestamp + two conditionalAnswers. “NO” cases are generated when a causal trap invalidates the intervention claim (confounding, collider/selection, post-treatment adjustment, Goodhart/proxy gaming, reverse causality/policy endogeneity, survivorship/attrition, or interference).


