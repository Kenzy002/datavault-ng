---
name: DataVault authentication testing
description: User-specified rule for testing DataVault signup and login.
---

Do not bypass authentication or use mock authentication.

**Why:** The user asked.

**How to apply:** Use real Clerk signup and sign-in flows for authentication tests. If a genuine flow cannot be safely completed, report the limitation instead of bypassing authentication.