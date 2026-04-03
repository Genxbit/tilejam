# Tilejam Agent Guide

This repository already uses a compact steering-doc setup. Treat these files as the source of truth:

* `docs/PRODUCT.md` for product intent, workflow, and scope
* `docs/TECH_WORKFLOW.md` for architecture, ticket structure, and validation rules
* `docs/FORMATS.md` for project, TMJ, TSJ, and export shape
* `docs/ITERATIONS.md` for the active ticket backlog
* `docs/ONBOARDING.md` for starting a new Codex session

## Working Style

* implement one ticket at a time
* keep the app runnable
* preserve existing supported behavior unless the ticket explicitly changes it
* update steering docs first when a new rule or format is introduced

## Architecture Focus

Follow `docs/TECH_WORKFLOW.md` closely:

* `app/` = orchestration only
* `systems/` = domain logic
* `data/` = state
* `rendering/` = draw only
* `ui/` = input and panels, not shared logic
* `io/` = load, save, export

When reviewing or implementing changes, check:

* no logic drift into `ui/`
* no domain behavior hidden in `rendering/`
* no cross-domain leakage when a dedicated system should own the rule
* `docs/FORMATS.md` stays aligned with any file-format change

## Commands

Use the repo root:

```bash
npm install
npm run dev
npm run build
```

## Reusable Reviews

A project-scoped Codex subagent lives at `.codex/agents/architecture-reviewer.toml`.
Use it when you want an architecture-focused review against `docs/TECH_WORKFLOW.md`.
