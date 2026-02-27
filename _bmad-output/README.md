# BMAD Structure for nostrmaxi

This directory contains Build-Measure-Agile-Document artifacts for systematic development.

## Structure

```
_bmad-output/
├── planning-artifacts/     Product vision, epics, user stories
├── sprints/               Sprint goals and retrospectives
├── architecture/          System design, API specs
└── testing/              Test plans, acceptance criteria
```

## Workflow

1. **Plan:** Write product vision + epic breakdown
2. **Sprint:** Define sprint goals + tasks
3. **Build:** Execute tasks systematically
4. **Measure:** Track metrics, test acceptance criteria
5. **Document:** Write retrospective, update docs
6. **Iterate:** Next sprint

## Templates

- `product-vision.md` - Define the problem/solution
- `epic-breakdown.md` - Break vision into epics + stories
- `sprint-NNN-goals.md` - Sprint planning
- `sprint-NNN-retrospective.md` - Sprint review
- `system-design.md` - Architecture documentation
- `test-plan.md` - Testing strategy

## Usage

1. Start with `product-vision.md` - define what you're building
2. Break it down in `epic-breakdown.md` - chunk into deliverables
3. Plan sprints in `sprint-001-goals.md` - focus on one epic at a time
4. Build, test, document
5. Write retrospective in `sprint-001-retrospective.md` - learn and improve

## Benefits

- **Clarity:** Everyone knows what we're building and why
- **Focus:** Sprints keep scope bounded
- **Quality:** Testing and acceptance criteria built in
- **Learning:** Retrospectives capture lessons
- **Continuity:** Documentation survives context loss
