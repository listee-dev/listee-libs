# @listee/db

## 0.3.0

### Minor Changes

- 8b03890: Add category/task update and delete APIs, expose updated query contracts, ensure account provisioning sets default categories, and enforce the profiles.default_category_id foreign key.

## 0.2.3

### Patch Changes

- 138cca7: Copy README.md and LICENSE into each dist folder during build so they ship with published packages.

## 0.2.2

### Patch Changes

- 35a2a3f: Ensure each package publishes from its `dist` manifest so npm tarballs include semver dependencies.

## 0.2.1

### Patch Changes

- fa3586b: Include package metadata files in npm publishes and resolve catalog/workspace dependencies to semver ranges when generating dist manifests.

## 0.2.0

### Minor Changes

- 73327cf: Add create routes, provisioning, and RLS client improvements.

## 0.1.1

### Patch Changes

- b5c3a8f: Update build tooling to use Turbo, TypeScript 5.6, rimraf clean scripts, and reusable dist manifest generation

## 0.1.0

### Minor Changes

- Initial OSS release, covering authentication utilities, database layer, API routes, and shared types.
