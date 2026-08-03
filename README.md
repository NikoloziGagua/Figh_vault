# Fight Vault

Fight Vault is a local-first training companion for combat-sports athletes. It turns coaching corrections into scheduled reviews and hands-free training sessions, then connects the results back to the next training plan.

## What it does

- Captures a technique and coaching cue in a few seconds, with optional browser dictation.
- Builds combinations from linked techniques instead of duplicated text.
- Schedules technique reviews using recall difficulty and review intervals.
- Runs configurable rounds with spoken callouts, cue narration, rests, bells, no-repeat shuffling, and screen wake lock where supported.
- Records reflections and uses them to update technique confidence and review timing.
- Shows weekly work, training history, weak techniques, and the latest lesson.
- Stores structured data in IndexedDB and migrates the original `fv-techniques`, `fv-combos`, and `fv-journal` localStorage data automatically.
- Exports and imports versioned JSON backups.
- Works as an installable offline PWA.

## Run locally

The application has no build step. Serve this directory with any static web server so service-worker and PWA features are available:

```powershell
npx serve .
```

Opening `index.html` directly also works for most features, but browsers do not register service workers from `file://` URLs.

## Deploy

GitHub Pages can publish the repository root directly. All asset paths are relative, so the app works from a project path such as `https://username.github.io/Figh_vault/`.

## Data and privacy

Fight Vault is local-first. Techniques, combinations, reviews, and sessions remain in the current browser unless the user explicitly exports a backup. Cloud accounts, cross-device sync, and uploaded video require a separately configured backend and are intentionally not implied by the current UI.
