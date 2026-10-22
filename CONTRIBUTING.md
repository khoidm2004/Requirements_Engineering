# Contribution Guide

Thank you for contributing. This project follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for all commit messages.

## Commit Message Format

```
<type>[optional scope][optional !]: <description>

[optional body]

[optional footer(s)]
```

### Rules

- **Type** is required and must be lowercase.
- **Scope** is optional; use it to name the affected area (module, package, or feature).
- **Description** is required: imperative mood, lowercase start, no trailing period, keep the subject line ≤ 72 characters.
- **Body** is optional; explain *why*, not only *what*. Wrap at ~72 characters.
- **Breaking changes** must use `!` after the type/scope and/or a `BREAKING CHANGE:` footer.

## Allowed Types

| Type       | When to use                                      | SemVer impact      |
| ---------- | ------------------------------------------------ | ------------------ |
| `feat`     | New user-facing feature                          | MINOR              |
| `fix`      | Bug fix                                          | PATCH              |
| `perf`     | Performance improvement                          | PATCH              |
| `refactor` | Code change that is neither a fix nor a feature  | none               |
| `docs`     | Documentation only                               | none               |
| `test`     | Add or update tests                              | none               |
| `build`    | Build system or dependency changes               | none               |
| `ci`       | CI configuration                                 | none               |
| `chore`    | Maintenance that does not affect production code | none               |
| `style`    | Formatting only (no logic change)                | none               |
| `revert`   | Revert a previous commit                         | depends on revert  |

## Scope

Use a short noun for the area you touched, for example:

- `api`
- `auth`
- `ui`
- `db`
- `deps`
- `config`

Example: `feat(auth): add OAuth2 login`

## Breaking Changes

Mark a breaking change in either (or both) of these ways:

1. Append `!` after the type or scope:
   ```
   feat(api)!: rename /v1/users to /v2/users
   ```
2. Add a footer:
   ```
   BREAKING CHANGE: /v1/users is removed; clients must use /v2/users
   ```

## Examples

**Feature**

```
feat(auth): add password reset flow

Allow users to request a reset link and set a new password.
Closes #42
```

**Bug fix**

```
fix(api): handle null payload in create endpoint

Return 400 instead of 500 when the request body is missing.
Fixes #108
```

**Docs**

```
docs: clarify install steps for macOS
```

**Chore / deps**

```
chore(deps): bump lodash to 4.17.21
```

**Breaking change**

```
feat(config)!: require explicit API base URL

BREAKING CHANGE: `API_URL` no longer has a default. Set it in `.env`
before starting the app.
```

**Revert**

```
revert: revert "feat(auth): add password reset flow"

Refs: abc1234
```

## Pull Requests

1. Create a branch from the default branch for your change.
2. Keep commits focused; prefer one logical change per commit.
3. Ensure the PR title also follows Conventional Commits (it may become the squash commit message).
4. Reference related issues in the body (`Closes #123`, `Fixes #456`).
5. Wait for review and a green CI before merge.

## Checklist Before Opening a PR

- [ ] Commit messages follow the format above
- [ ] Description is imperative and under 72 characters
- [ ] Breaking changes are marked with `!` and/or `BREAKING CHANGE:`
- [ ] Related issues are linked
- [ ] Tests and docs are updated when needed
