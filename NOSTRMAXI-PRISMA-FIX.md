# NostrMaxi Prisma Binary Mismatch Fix

**Date:** 2026-02-16  
**Project Path:** `~/strangesignal/projects/nostrmaxi`  
**Status:** ✅ Completed

## 1) Repository Check

- Located repository at: `~/strangesignal/projects/nostrmaxi`
- Repo exists, so proceeded with diagnosis and fix.

## 2) Diagnosis

### Findings

- Runtime/build targets include Alpine Linux (`node:20-alpine` in `Dockerfile` and `Dockerfile.prod`), which requires a **musl** Prisma engine.
- `prisma/schema.prisma` generator initially had no `binaryTargets`, so generated client was environment-dependent.
- This can produce binary mismatch errors when generated on one platform and run on another (e.g., Debian host vs Alpine container).

### Version Check

- Verified Prisma environment with `npx prisma -v`.
- Briefly attempted latest Prisma (v7), but it is incompatible with current schema style in this repo (datasource `url` handling changed in Prisma 7).
- Re-pinned to Prisma 5.22.0 to match current project architecture.

## 3) Changes Applied

### A) Set explicit Prisma binary targets

Updated `prisma/schema.prisma` generator block:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

This ensures generated client includes:
- native target for local environment
- musl+OpenSSL 3 target for Alpine-based runtime

### B) Normalize Prisma package versions

Executed:

```bash
npm install prisma@5.22.0 @prisma/client@5.22.0
```

Result in `package.json`:
- `dependencies.@prisma/client`: `^5.22.0`
- `devDependencies.prisma`: `^5.22.0`

### C) Regenerate Prisma client

Executed:

```bash
npx prisma generate
```

Result: successful generation of Prisma Client v5.22.0.

## 4) Sanity Checks

### Check 1: Prisma Client generation

- `npx prisma generate` ✅ success

### Check 2: Engine binaries present

Verified generated binaries include both targets:

- `libquery_engine-debian-openssl-3.0.x.so.node`
- `libquery_engine-linux-musl-openssl-3.0.x.so.node`

### Check 3: Client instantiation

Executed Node one-liner to instantiate `PrismaClient`:

- `PrismaClient instantiate OK` ✅

### Check 4: Project build

Executed:

```bash
npm run build
```

- Build completed successfully ✅

## 5) Final Status

✅ Prisma binary mismatch risk addressed for Debian host + Alpine container runtime.

## 6) Files Modified

- `prisma/schema.prisma`
- `package.json`
- `package-lock.json`
- `NOSTRMAXI-PRISMA-FIX.md` (this report)
