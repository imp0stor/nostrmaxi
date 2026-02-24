# P1 Remediation Wave 2 - NostrMaxi

**Date:** 2026-02-17
**Scope:** Remaining P1 audit items (structured logging, DTO validation, pooling guidance, missing indexes)

## ✅ Changes Shipped

### 1) Structured Logging (Winston)
- Added `nest-winston` logger and JSON log formatting.
- Replaced webhook `console` usage with Nest logger to emit structured logs.

**Files:**
- `package.json`
- `src/common/logger.ts`
- `src/main.ts`
- `src/payments/payments.controller.ts`

### 2) DTO Validation for API Requests
Converted inline body payloads to class-validator DTOs.

**Files:**
- `src/auth/dto/auth.dto.ts`
- `src/commerce/dto/commerce.dto.ts`
- `src/api-keys/dto/api-keys.dto.ts`
- `src/subscription/dto/subscription.dto.ts`
- `src/payments/dto/payments.dto.ts`
- Updated controllers to use DTOs:
  - `src/auth/auth.controller.ts`
  - `src/commerce/commerce.controller.ts`
  - `src/api-keys/api-keys.controller.ts`
  - `src/subscription/subscription.controller.ts`
  - `src/payments/payments.controller.ts`

### 3) Prisma Indexes
- Added composite index for WoT queries.

**File:**
- `prisma/schema.prisma` → `@@index([userId, trustScore])`

### 4) Database Connection Pooling Guidance
- Added explicit pool configuration examples in deploy docs.

**File:**
- `README-DEPLOY.md`

---

## 🧪 Test Evidence

```bash
npm test -- --runTestsByPath \
  src/__tests__/auth.test.ts \
  src/__tests__/commerce.test.ts \
  src/__tests__/payments.test.ts
```

**Result:** 3 suites passed (57 tests).

---

## 🔁 Rollback Notes

1. **Structured logging:**
   - Revert `src/common/logger.ts` import in `src/main.ts` and remove `nest-winston`/`winston` deps.
   - Restore any `console.log` usage if needed.

2. **DTO validation:**
   - Revert controllers to accept inline body shapes.
   - Remove DTO files if rollback is required.

3. **Prisma index:**
   - Remove `@@index([userId, trustScore])` from `schema.prisma`.
   - Apply rollback by regenerating Prisma client and re-running migrations if used.

4. **Pooling doc updates:**
   - Revert `README-DEPLOY.md` section.

---

## ✅ Status
All remaining P1 remediation items are implemented and validated.
