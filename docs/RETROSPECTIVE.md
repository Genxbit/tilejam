# RETROSPECTIVE.md

## Scope

This retrospective covers work from Ticket 1 through Ticket 7.

It is based on:

* the git commit history
* `docs/TECH_WORKFLOW.md`
* `docs/PRODUCT.md`
* `docs/ITERATIONS.md`

---

## Summary

This project went better than a previous project because the technical architecture was defined early and then used actively during implementation, not only written once and ignored.

The main difference was:

* architecture was established early in `docs/TECH_WORKFLOW.md`
* product and format docs were treated as source of truth
* tickets were kept relatively small
* architecture validation was added to each ticket
* architectural drift was corrected during the ticket flow instead of postponed

That reduced late refactoring pressure, even though some direction changes still happened.

---

## What Went Well

### 1. Architecture was set early

This was the biggest improvement.

The split between:

* `app/`
* `systems/`
* `rendering/`
* `ui/`
* `io/`
* `types/`

gave the project a stable backbone early.

That made it easier to add:

* project load/save
* working PNG persistence
* export
* scene editing

without collapsing everything into one controller or one renderer.

Compared with the earlier project, this prevented a large class of later “unwind and refactor” work.

### 2. Architecture validation per ticket was valuable

Adding architecture validation to each ticket in `docs/ITERATIONS.md` was a strong decision.

It changed the process from:

* “feature works”

to:

* “feature works and still matches the architecture”

That mattered because several issues were caught as architectural problems, not just bugs:

* project shape drifting away from `FORMATS.md`
* UI/session messaging leaking into systems and IO
* grid ownership not being centralized enough
* persistence behavior not matching the intended model

This kept the codebase cleaner while the feature set was still growing quickly.

### 3. Docs were treated as living design tools

The docs were revised when the product understanding changed.

Important examples:

* Ticket 2 was reworked after the source-grid vs target-grid model became clearer
* Ticket 6 was reframed around working PNG persistence
* Ticket 7 was prepared by extending `FORMATS.md` and `TECH_WORKFLOW.md` before coding

That kept implementation closer to the actual product instead of forcing the product to fit outdated docs.

### 4. The project evolved in useful layers

The commit history shows a good layering pattern:

* scaffold
* grid
* selection and placement
* tile editing
* export
* persistence
* scene editing

That sequence was sensible.

Even when the product direction shifted, the project usually extended existing concepts instead of throwing them away entirely.

### 5. Persistent artifacts improved the model

The move toward:

* working/output PNG as visual truth
* `.tilejam.json` as richer editable truth
* `TSJ` and `TMJ` as interoperability formats

was a strong clarification.

That gave the project a much better mental model than relying too much on long undo history or transient browser state.

---

## What Could Have Been Better

### 1. Product understanding shifted after implementation had already started

The largest inefficiency came from discovering the real product model while coding.

Examples from the history:

* Ticket 2 was first implemented in the wrong direction and then re-implemented
* Ticket 3 had to be revisited after the source/target workflow became clearer
* Ticket 6 changed meaning significantly after the working PNG model was defined

This was still much better than the previous project, but it shows that:

* product clarification still came later than ideal

The next time, it would help to lock down earlier:

* the core source/target mental model
* what is editable truth
* what is visual truth
* which formats are first-class from day one

### 2. Format semantics could have been defined earlier

Several bugs and design corrections came from format ambiguity:

* whether source images should be embedded or referenced
* how working PNG relates to project JSON
* how TSJ image naming should work
* how scene data should relate to tilesheet state

`docs/FORMATS.md` became much better over time, but some of this clarity arrived after implementation had already started.

Earlier format precision would likely have reduced:

* persistence churn
* import/export corrections
* naming/reference inconsistencies

### 3. Some tickets carried too much product discovery

A few tickets mixed:

* feature implementation
* product redesign
* architecture cleanup
* UX restructuring

That happened especially around:

* Ticket 2
* Ticket 6
* Ticket 7

This was manageable, but it means the tickets were not always as small and isolated as intended.

In future work, it may help to explicitly separate:

* “doc/architecture correction”
* “feature implementation”
* “UX refinement”

when the product model changes significantly.

### 4. Some workflow/UI issues were discovered only through late manual testing

A number of important usability issues showed up only after the main feature existed:

* save behavior expectations
* selection clearing after scene placement
* layer ordering confusion
* missing tilesheet recovery in scene mode
* sidebar structure confusion

This suggests a useful improvement:

* do a short UX/manual test pass at the end of each ticket, not only technical validation

The code architecture held up well, but some UX feedback loops could have been shorter.

### 5. Naming and interoperability details needed repeated cleanup

Several small but important details needed follow-up fixes:

* working image naming in labels
* TSJ image naming
* scene tileset source defaults
* clearer missing-state messaging

These were not structural failures, but they show that interoperability features need stronger end-to-end naming rules earlier.

---

## Evidence From History

The commit history reflects the overall pattern clearly:

* early foundation:
  `Initial commit`
  `Added project markdowns`
  `Ticket 1: Scaffold + layout + image loading`
* early architecture correction:
  `Updated docs markdown after review`
  `Ticket 1: Fix to follow tech architecture and incorrect project loading`
* mid-project product correction:
  `Updated markup docs as they were unclear`
  `Ticket 2: Re-implemented as wrong direction early`
* process improvement:
  `Added step to validate architecture for each ticket in iterations`
* persistence model clarification:
  `Updated ticket 6 to treat working tile as png`
  `Ticket 6: Project save/load`
* scene preparation before implementation:
  `Prepare for ticket 7 and scene editing support`
  `Ticket 7: Scene editor + TMJ`
* post-feature UX and workflow hardening:
  `Improving men UX when loading a scene with corresponding tilesheet`
  `Improved layer ordering and settings for layer name, offset, and parallax`

This shows a healthy pattern overall:

* foundation
* correction
* implementation
* UX hardening

But it also shows where the team still paid for product clarification arriving mid-stream.

---

## Biggest Improvement Compared With The Earlier Project

The biggest improvement was not just “having architecture.”

It was:

* defining architecture early
* using it as a real decision tool
* validating every ticket against it
* correcting drift as part of normal delivery

That changed architecture from documentation into process.

This likely prevented a much larger refactor later.

---

## Recommendations For Next Time

### Keep doing

* define architecture early
* keep `PRODUCT.md`, `TECH_WORKFLOW.md`, `FORMATS.md`, and `ITERATIONS.md` aligned
* validate architecture for every ticket
* keep domains explicit
* treat persistence and interoperability formats as first-class design concerns

### Improve

* lock down product mental model earlier
* define format semantics earlier and more strictly
* separate architecture/doc corrections from implementation work when scope shifts
* add a lightweight UX/manual validation pass per ticket
* define naming and path conventions for exported artifacts sooner

---

## Final Assessment

Up to Ticket 7, the project appears to have gone well.

There were still course corrections, but they happened within a process that was much more controlled than the earlier project.

The most important success was that architecture was not postponed, and not treated as theory. It was introduced early, reused repeatedly, and enforced ticket by ticket. That is the main reason this project stayed extendable while moving from tilesheet cleanup into scene editing.
