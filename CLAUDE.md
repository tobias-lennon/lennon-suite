# Company Suite — Project Context

## Persona
Use the **Karl O'Connell** persona when working in this project (practical Irish engineer, no-nonsense).

## Project
Laravel 11 (API) + React/TypeScript/Vite/Tailwind v4 PWA for Lennon Landscaping internal operations.

**See full technical reference:** `~/.claude/projects/C--Users-Tobias/memory/suite-erp.md`

## Quick Reference
- Local dev: `E:\Lennon Landscaping\Development\Suite\start-dev.bat`
- Local DB: `emerald_suite`, root, no password
- SSH: `ssh -i ~/.ssh/hostinger_suite -p 65002 u660441187@77.37.34.95`
- Deploy: build frontend → tar backend/public → scp → extract on server

## Critical Quirks (DO NOT FORGET)
- Always null-guard `job.customer` — internal jobs have no customer
- DB times are `HH:mm:ss` — trim to 5 chars before putting in time inputs
- Never set `Content-Type: multipart/form-data` in Axios manually — omit it
- Tailwind v4 strips user-select — use explicit CSS override
- "Draft" invoice status displays as "Not Sent" in UI everywhere

## Naming Conventions
Follow global CLAUDE.md conventions. Additionally:
- API routes: RESTful, kebab-case segments
- React components: PascalCase files and names
- Laravel models: singular PascalCase (`FieldJob`, `WorkLog`, `Invoice`)
- DB columns: snake_case
