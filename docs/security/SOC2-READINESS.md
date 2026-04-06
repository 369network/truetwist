# SOC2 Type II Readiness — Gap Analysis

**Author:** Security Engineer (TrueTwist)
**Date:** 2026-04-06
**Status:** Draft — post-hardening assessment

---

## 1. Executive Summary

This document assesses TrueTwist's readiness against SOC2 Type II Trust Service Criteria (TSC). The assessment covers the five trust principles: Security, Availability, Processing Integrity, Confidentiality, and Privacy.

**Overall readiness: ~65% after hardening sprint (up from ~35%)**

---

## 2. Security (Common Criteria)

### 2.1 Access Control (CC6.1–CC6.8)

| Control | Status | Notes |
|---------|--------|-------|
| Role-based access (RBAC) | ✅ Implemented | Owner/Admin/Editor/Viewer roles in `src/lib/permissions.ts` |
| JWT authentication | ✅ Implemented | 15-min access tokens, 7-day refresh with rotation |
| Password hashing | ✅ Implemented | bcrypt with 12 salt rounds |
| OAuth integration | ✅ Implemented | Google & Apple via NextAuth |
| API key authentication | ✅ Implemented | Scoped keys with SHA-256 hashing, `tt_` prefix |
| Session management | ✅ Hardened | Refresh token rotation, reuse detection, revocation |
| Concurrent session limits | ⚠️ Configured | Limit defined in `security-config.ts`, enforcement pending |
| MFA / 2FA | ❌ Not implemented | **HIGH PRIORITY** — required for SOC2 |

### 2.2 Network Security

| Control | Status | Notes |
|---------|--------|-------|
| HTTPS enforcement | ✅ Implemented | HSTS header (2-year max-age, includeSubDomains, preload) |
| CSP headers | ✅ Implemented | Strict policy in middleware |
| CORS policy | ✅ Implemented | Origin allowlist against `NEXT_PUBLIC_APP_URL` |
| X-Frame-Options | ✅ Implemented | DENY |
| Rate limiting | ✅ Implemented | Edge-level + Redis-backed per-plan limits |
| DDoS protection | ✅ Partial | Vercel edge network provides baseline; no custom WAF |

### 2.3 Data Protection

| Control | Status | Notes |
|---------|--------|-------|
| Encryption in transit | ✅ TLS | Vercel terminates TLS; Supabase connections over SSL |
| Encryption at rest | ✅ Supabase | Supabase uses AES-256 for all data at rest (Postgres TDE) |
| Secret management | ⚠️ Partial | Env vars via Vercel; no vault integration (e.g., HashiCorp Vault) |
| PII handling | ⚠️ Partial | Email/name stored; no field-level encryption |
| Backup encryption | ✅ Supabase | Automated encrypted backups by Supabase |

### 2.4 Monitoring & Logging

| Control | Status | Notes |
|---------|--------|-------|
| Audit logging | ✅ Implemented | `AuditLog` model — auth events, API key ops, team changes |
| Failed auth logging | ✅ Implemented | Login failures logged with IP, severity=warning |
| Token reuse detection | ✅ Implemented | Logged with severity=critical |
| Centralized log aggregation | ⚠️ Partial | Console + DB logs; no SIEM integration yet |
| Alerting on anomalies | ❌ Not implemented | Need integration with PagerDuty/Opsgenie |

---

## 3. Availability (A1)

| Control | Status | Notes |
|---------|--------|-------|
| Uptime SLA | ✅ Vercel | 99.99% SLA on Vercel Pro/Enterprise |
| Health check endpoint | ✅ Exists | `/api/v1/health` |
| Auto-scaling | ✅ Vercel | Serverless auto-scaling |
| Disaster recovery plan | ❌ Not documented | Need formal DR runbook |
| Database failover | ✅ Supabase | Supabase provides automated failover |
| Incident response plan | ❌ Not documented | Need formal IRP |

---

## 4. Processing Integrity (PI1)

| Control | Status | Notes |
|---------|--------|-------|
| Input validation | ✅ Implemented | Zod schemas on all endpoints |
| SQL injection prevention | ✅ Implemented | Prisma ORM (parameterized queries) |
| XSS prevention | ✅ Implemented | CSP headers + React auto-escaping |
| CSRF protection | ✅ Implemented | Double-submit cookie pattern, __Host- prefix |
| Webhook signature verification | ✅ Implemented | Stripe HMAC-SHA256 verification |

---

## 5. Confidentiality (C1)

| Control | Status | Notes |
|---------|--------|-------|
| Data classification | ❌ Not implemented | Need data classification policy |
| Access reviews | ❌ Not implemented | Need quarterly access review process |
| Data retention policy | ❌ Not documented | Need formal policy + automated enforcement |
| NDA/confidentiality agreements | N/A | Organizational control |

---

## 6. Privacy (P1–P8)

| Control | Status | Notes |
|---------|--------|-------|
| Privacy policy | ❌ Not verified | Legal review needed |
| Data subject rights (GDPR) | ⚠️ Partial | User delete exists; no export/portability endpoint |
| Cookie consent | ❌ Not implemented | Need consent banner for EU compliance |
| Data processing agreements | N/A | Organizational control with Supabase, Vercel, Stripe |
| Right to deletion | ⚠️ Partial | User delete cascade exists; audit log retention TBD |

---

## 7. Encryption at Rest — Detailed Audit

### Supabase (Primary Database)
- **Engine:** PostgreSQL 15+ managed by Supabase
- **Encryption:** AES-256 encryption at rest enabled by default on all Supabase projects
- **Key management:** Managed by Supabase (AWS KMS under the hood)
- **Backup encryption:** Automated daily backups, encrypted at rest

### Vercel (Application Hosting)
- **Static assets:** Served via Vercel CDN over TLS
- **Environment variables:** Encrypted at rest in Vercel's infrastructure
- **Build artifacts:** Encrypted at rest

### Redis (Rate Limiting / Caching)
- **Provider:** Dependent on `REDIS_URL` configuration
- **Recommendation:** Ensure TLS is enabled (`rediss://` protocol) and at-rest encryption is configured

### Stripe (Payment Processing)
- **PCI DSS Level 1:** Stripe handles all card data; TrueTwist never stores card numbers
- **Webhook secrets:** Stored as environment variables, verified via HMAC

### Gaps
1. **No field-level encryption** for PII (email, name) — consider `pgcrypto` or application-level encryption for sensitive fields
2. **Redis TLS** — verify `REDIS_URL` uses `rediss://` protocol
3. **No client-side encryption** — uploaded media goes to R2/S3 without client-side envelope encryption

---

## 8. Priority Remediation Roadmap

### Critical (Before SOC2 audit)
1. **Implement MFA/2FA** — TOTP or WebAuthn for all users
2. **SIEM integration** — Ship audit logs to Datadog/Splunk/CloudWatch
3. **Incident response plan** — Document escalation paths, SLAs
4. **Disaster recovery plan** — Document RTO/RPO, test backup restoration
5. **Data classification policy** — Classify PII, business data, public data

### High Priority
6. **Access review process** — Quarterly reviews of RBAC assignments
7. **Data retention policy** — Define retention periods, implement automated purge
8. **Cookie consent** — Implement banner with GDPR-compliant opt-in
9. **Redis TLS verification** — Ensure encrypted connections
10. **Concurrent session enforcement** — Implement the limit defined in `security-config.ts`

### Medium Priority
11. **Field-level encryption** for PII columns
12. **Secrets vault** — Migrate from env vars to HashiCorp Vault or AWS Secrets Manager
13. **Penetration testing** — Schedule annual third-party pentest
14. **Security awareness training** — Document for all team members
15. **Vulnerability scanning** — Integrate Snyk/Dependabot for dependency monitoring

---

## 9. Files Modified/Created in This Sprint

| File | Change |
|------|--------|
| `src/middleware.ts` | Added security headers (CSP, HSTS, X-Frame-Options, etc.), edge rate limiting |
| `src/middleware/csrf.ts` | New — CSRF double-submit cookie validation |
| `src/app/api/v1/csrf/route.ts` | New — CSRF token issuance endpoint |
| `src/lib/audit.ts` | New — Audit logging utility with fire-and-forget writes |
| `src/lib/security-config.ts` | New — Centralized security configuration |
| `prisma/schema.prisma` | Added `AuditLog` model |
| `prisma/migrations/add_audit_log/` | New migration for `audit_logs` table |
| `src/app/api/v1/auth/login/route.ts` | Added audit logging (success + failure) |
| `src/app/api/v1/auth/register/route.ts` | Added audit logging |
| `src/app/api/v1/auth/refresh/route.ts` | Added audit logging + token reuse detection logging |
