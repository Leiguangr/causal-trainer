## 3. Interesting Findings


### Discovery 1: LLMs Know Causal Inference, But Don't Apply It By Default


A key observation: LLMs possess comprehensive knowledge of causal inference techniques—confounding, selection bias, identification strategies, etc. However, when evaluating a causal claim, **they don't naturally apply scientific rigor**.


Left unprompted, an LLM will often accept "X caused Y because Y followed X" or validate claims with hand-wavy methodology ("controlled for relevant factors"). This is precisely the kind of reasoning the benchmark is designed to test and penalize.


**Implication**: The benchmark isn't testing whether models *know* causal inference—it's testing whether they *apply* it as a first instinct when evaluating real-world claims. This is a behavioral/reasoning test, not a knowledge test.


### Discovery 2: Ground Truth Labels Are Less Subjective Than Expected


Through iterating on many annotations, a clear pattern emerged: **YES/NO/AMBIGUOUS is not as open-ended as one might initially think**. There is a specific, concrete set of criteria that makes a causal analysis "scientifically acceptable":


| Ground Truth | Criteria |
|--------------|----------|
| **YES** | Randomization OR valid quasi-experiment with explicit identification strategy OR established mechanism with appropriate controls |
| **NO** | Identifiable flaw (confounding, selection, reverse causation, etc.) that can be NAMED from the given information |
| **AMBIGUOUS** | Method mentioned but key assumptions unstated; cannot confirm validity OR identify specific flaw |


The task of annotation for L2 is really about: **Does the scenario provide the specific elements that constitute rigorous causal analysis?** If RCT/natural experiment/explicit identification strategy is present → YES. If a trap is identifiable → NO. If methodology is vague → AMBIGUOUS.


This makes labeling surprisingly systematic once the criteria are internalized.


### Discovery 3: Scenarios Must Describe Observables, Not Intentions


Early LLM outputs included phrases like "brokers trade merely to meet targets rather than to make profits." This describes actor intentions (unobservable) rather than observable patterns. We refined prompts to require behavioral descriptions: "trading volume increased 300% while profit per trade decreased 50%."


### Discovery 4: L2 Scenarios MUST Include an Actor Making a Claim


L1 traps are in the data structure. L2/L3 traps are in how someone INTERPRETS an intervention. Without an analyst/policymaker/researcher making a specific claim about their methodology, there's no flaw to identify. This insight fundamentally changed our L2/L3 generation prompts.


### Discovery 5: Quasi-Experiments Are Problematic for Synthetic YES Cases


In synthetic data, quasi-experimental validity is asserted ("controlled for all confounders") rather than demonstrated. We now recommend:
- L2 YES → Require explicit RCT or natural experiment
- L2 NO/AMBIGUOUS → Quasi-experiments excellent for illustrating limitations



Discovery 6: Bias towards creating positive correlation over negative correlation

Even though Berkson Paradox falls under collider, I just skimmed through all the data and I have not seen a case where conditioning on Z creates negative correlation. I think this is a limitation to the generation step, where without us explicitly stating to generate both positive and negative correlation, the LLM defaulted to generating positive correlations. Likely because positive correlations are more common in data it was trained on. I manually modified my cases to introduce an example of Berkson paradox and created a new subtype called Berkson_Paradox. 



