# Demo queries

Run these against the seeded corpus via `POST /api/chat` (or the chat-bar UI once Phase 5 lands) to sanity-check that the chat-bar pipeline produces substantive, cited answers for in-corpus questions and the canonical refusal for out-of-corpus questions.

Each query is annotated with what we'd expect to see.

## In-corpus (should produce cited answers)

1. **How do I evaluate the quality of an ABA provider before committing?**
   *Expected: cites the parent interview's framework questions; may cite Crosswind ABA Clinic and the Henderson EIBI paper indirectly via the synthesized question body.*

2. **What are the options for a teen girl who masks heavily?**
   *Expected: cites Lighthouse Center for Autism Evaluation, the Vasquez 2017 masking paper, Riverview Social Skills Clinic, Aspire NYC, PEERS Social Skills Curriculum, and the existing "evaluator for masking teen girl" question.*

3. **Where can I find a thorough autism evaluation in the NYC area?**
   *Expected: cites Lighthouse Center for Autism Evaluation; may cite Hudson Therapy Placement for referrals.*

4. **What does the research say about long-term outcomes of EIBI?**
   *Expected: cites the Henderson 2019 EIBI meta-analysis; may add contributor caveats from the parent interview about provider-level variation.*

5. **How do I plan a sensory diet that the school can actually follow?**
   *Expected: cites the Park 2018 sensory paper; may cite the special ed teacher's framing about weekly provider coordination.*

6. **What are good transition programs for young adults aging out of high school?**
   *Expected: cites Summit Bridges Transition Program and the Mahmoud 2021 transition paper; may cite City Connect Initiative.*

7. **How should I think about autistic burnout in late-diagnosed adults?**
   *Expected: cites the Reyes 2020 burnout paper and the late-diagnosed adult interview.*

8. **Where can I find autistic-led peer support in NYC?**
   *Expected: cites the Autistic Self Advocacy Network NYC Chapter; may cite the late-diagnosed adult interview's question about peer support.*

9. **Are there schools that take a sensory-first approach for elementary-age kids?**
   *Expected: cites Cedarbrook School (introduced via interview 02) and the Park 2018 sensory paper.*

## Out-of-corpus (should trigger the canonical refusal)

10. **What's the recommended treatment protocol for autism in adult dogs?**
    *Expected: the canonical refusal — "The bin doesn't cover this yet. If you have knowledge of this, please contribute via the Contribute link."*

## Smoke checks

A future `/scripts/smoke-queries.ts` could run these via the chat-bar pipeline and flag any unexpected refusal on the in-corpus queries, or any in-corpus citation on the out-of-corpus query.
