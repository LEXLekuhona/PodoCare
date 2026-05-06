# Pull Request

## Summary

- What changed?
- Why now?

## Sprint / Priority

- [ ] P0 (core stability)
- [ ] P1 (content funnel)
- [ ] P1.5 (quiz)
- [ ] P2 (clinical value)
- [ ] P3 (monetization)

## Release Checklist

Reference: `docs/release-checklist.md`

### Core stability

- [ ] `pnpm --filter @srs/api test:e2e:core -- --ci` is green
- [ ] New/changed protected endpoints have `401/403` tests
- [ ] No new core e2e flakes

### DB and contracts

- [ ] Prisma migrations included and validated
- [ ] DTO/API backward compatibility checked
- [ ] Breaking changes documented with rollout plan

### Queues and jobs

- [ ] `GET /api/v1/health/queues` validated
- [ ] Reminder/lifecycle jobs smoke-tested
- [ ] Revoke/reschedule/cancel scenarios verified

### Observability and docs

- [ ] Alerts/runbook updated if needed
- [ ] README/roadmap updated
- [ ] Sprint-end stability baseline updated in `docs/roadmap.md` (pass rate / flaky rate / queue incidents)
- [ ] Release notes prepared

## Test Plan

- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Manual smoke (staging)
