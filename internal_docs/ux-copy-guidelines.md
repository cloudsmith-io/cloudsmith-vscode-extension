# UX Copy Guidelines

Reference document for all user-facing text in Cloudsmith products and extensions.
This is the single source of truth for copy style, tone, and terminology.

---

## Principles

### 1. Clarity over cleverness

Say only what is needed. No filler, no repetition. If the UI already provides context, do not restate it in the label or message.

### 2. American English

All copy uses American English spelling and idiom.

### 3. Plain language

Write so that a layperson can understand the text without domain expertise. Avoid jargon, internal terminology, or implementation details unless they help the user act or understand risk.

### 4. Calm, neutral tone

No exclamation marks. No dramatic phrasing ("Tread carefully," "Are you absolutely sure?"). State facts plainly.

### 5. Avoid addressing the user directly

Do not use "you" or "your" unless the sentence is unreadable without it. Focus on the feature or behavior, not the reader.

| Avoid | Prefer |
|-------|--------|
| Automatically delete packages that match **your** query and exceed the limits **you** set. | Automatically deletes packages that match the configured query and exceed defined limits for count, age, or total size. |

### 6. Sentence case

Capitalize only proper nouns, product names, and the first word of a sentence or label. Everything else is lowercase.

| Avoid | Prefer |
|-------|--------|
| Regenerate GPG Key | Regenerate GPG key |
| Copy To Clipboard | Copy |

### 7. Context-aware brevity

Every message should make sense where it appears. A checkbox under "Permissions" should say "Write," not "Enable write." A terminal log can afford to be more verbose than a tooltip.

### 8. Specific actions and consequences

State exactly what will change and what will not. If an action is irreversible, say so once, plainly.

> Regenerating the key keeps the public key and deletes the private key. Old packages will not be re-signed. This cannot be undone.

### 9. Active voice with clear next steps

Lead with the action. For errors, state how to fix the problem. For confirmations, state what succeeded.

| Type | Example |
|------|---------|
| Error | File size exceeds the limit. |
| Success | Package deleted. |
| Guidance | Run `cloudsmith whoami` to confirm the CLI is connected. |

### 10. Explain unfamiliar features by their value

Start with the benefit in one sentence, then explain how it works. No marketing language.

| Avoid | Prefer |
|-------|--------|
| Create a new vulnerability policy or edit an existing one. New policies are evaluated and enforced after a scheduled security scan. | Vulnerability policies help keep software secure by blocking risky packages. Policies are evaluated and enforced after each scheduled security scan. |

---

## Canonical terminology

Use these exact terms. Do not introduce synonyms or alternate phrasing.

### Actions

| Canonical term | Do not use |
|----------------|------------|
| Copy | Copy to clipboard, Copy to Clipboard |
| Delete | Remove (when the action is permanent) |
| Write | Enable write |
| Retry | Try again |
| Sign in | Log in, Login |
| Sign out | Log out, Logout |
| Set up | Setup (as a verb) |
| Search | Find, Look up |

### Nouns

| Canonical term | Do not use |
|----------------|------------|
| Package | Artifact (in user-facing copy) |
| Repository | Repo (in user-facing copy) |
| Namespace | Organization, Org (unless referring to the Cloudsmith entity specifically) |
| Upstream | Upstream source, Upstream proxy source |
| API key | API token, Auth token (when referring to the Cloudsmith API key specifically) |
| Service account | Bot account, Machine user |
| Entitlement token | Download token (in user-facing copy) |

### Confirmations

Use direct past-tense confirmations. No filler words.

| Avoid | Prefer |
|-------|--------|
| Successfully deleted the package. | Package deleted. |
| The repository was created successfully. | Repository created. |
| Your API key has been copied to the clipboard. | API key copied. |
| The upload completed without errors. | Upload complete. |

### Irreversible warnings

Use a single calm sentence. No bold, no exclamation marks.

| Avoid | Prefer |
|-------|--------|
| You will not be able to recover this data! | This cannot be undone. |
| Are you absolutely sure? This action is permanent and irreversible. | This action is permanent. This cannot be undone. |

### Empty states

State what the view would normally show, then suggest the next step.

| Avoid | Prefer |
|-------|--------|
| There are no packages here yet! | No packages. Create or push a package to get started. |
| You don't have any repositories. | No repositories. Select "New repository" to create one. |

### Errors

Errors should be actionable when possible. State what went wrong and what to do next.

| Avoid | Prefer |
|-------|--------|
| Something went wrong. | Could not load packages. Check the connection and try again. |
| An error occurred while fetching data. | Failed to fetch repository data. Verify the API key and retry. |
| Invalid input. | Invalid package name. Use only lowercase letters, numbers, and hyphens. |

---

## String interpolation rules

All copy that includes dynamic values must follow these rules to prevent broken or awkward output.

### Template literal safety

When editing strings that contain template variables (`${variable}`, `{variable}`, `%s`, `{0}`), preserve the variable references exactly. Do not move, rename, or remove them.

```
// Original
`Package "${name}" deleted from ${repository}.`

// Acceptable edit (improving copy around the variable)
`Package "${name}" deleted.`

// Unacceptable edit (variable reference broken)
`Package deleted from the repository.`   // lost ${repository}
`Package "${Name}" deleted.`             // changed variable casing
```

### Pluralization

Dynamic counts must handle singular and plural forms correctly. If editing a string with a count variable, verify the plural logic still works.

```
// Correct
`${count} package${count === 1 ? '' : 's'} found.`

// Also correct (if a pluralization utility exists)
`${count} ${pluralize('package', count)} found.`

// Wrong
`${count} packages found.`   // broken at count === 1
```

### Punctuation around variables

Do not place a period or comma directly inside a template expression. Punctuation goes outside.

```
// Correct
`Package "${name}" deleted.`

// Wrong
`Package "${name}." deleted`
```

### Variable context

When dynamic values appear in user-facing text, the surrounding copy must make sense regardless of the value's length or content. Avoid constructions where a long value would break the layout or meaning.

```
// Fragile (long repo names break the sentence flow)
`The repository ${repositoryName} in namespace ${namespace} has been created and is now active.`

// Resilient
`Repository created: ${repositoryName}`
```

---

## Quick-reference table

| Pattern | Template |
|---------|----------|
| Confirmation | `[Noun] [past-tense verb].` |
| Irreversible warning | `This cannot be undone.` |
| Empty state | `No [noun]s. [Next step].` |
| Error (actionable) | `[What happened]. [How to fix].` |
| Error (non-actionable) | `[What happened]. Try again later.` |
| Feature intro | `[Benefit]. [How it works].` |

---

## Before/after examples

| Before | After | Rule applied |
|--------|-------|-------------|
| This is a public package | Public package | Clarity, context-aware brevity |
| Copy to Clipboard | Copy | Canonical action term |
| Enable write | Write | Context-aware brevity |
| Successfully deleted package | Package deleted. | Canonical confirmation |
| You must select a repository | Select a repository. | Avoid "you," active voice |
| Are you **absolutely** sure you want to make repository **Jason Test** *public*? | 1340 packages in Jason Test will be visible to anyone on the internet. | Specific consequences, calm tone |
| Tread carefully. | This cannot be undone. | Calm tone, no drama |
| Something went wrong! | Could not complete the request. Check the connection and retry. | Actionable error, no exclamation |
