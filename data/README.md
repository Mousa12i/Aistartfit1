# Data Directory

## free-exercise-db.json

**Source:** https://github.com/yuhonas/free-exercise-db  
**License:** The Unlicense, public domain (see LICENSE.md in the source repository)  
**Downloaded:** 2026-10-12

This file contains the complete exercise dataset from the free-exercise-db project.
It is a JSON array of 876 exercise records, each with the following fields:

- `id` — unique exercise identifier (string, derived from the exercise name)
- `name` — exercise name
- `force` — "push", "pull", or null
- `level` — "beginner", "intermediate", or "advanced"
- `mechanic` — "compound", "isolation", or null
- `equipment` — equipment type (e.g. "barbell", "dumbbell", "body only")
- `primaryMuscles` — array of primary muscle group strings
- `secondaryMuscles` — array of secondary muscle group strings
- `instructions` — array of instruction step strings
- `category` — "strength", "stretching", "cardio", etc.
- `images` — array of relative image paths (hosted at the source repository)

### Validation Summary

| Metric | Value |
|---|---|
| Total records | 876 |
| Unique IDs | 876 |
| Duplicate IDs | 0 |
| Invalid records | 0 |
| File size | ~1 MB |

This dataset will be imported into the Supabase `exercises` table in Phase 2,
replacing the current seeded exercise rows while preserving existing workout
history, set logs, and user data.
