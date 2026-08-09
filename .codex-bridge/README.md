# OING Codex Bridge queue

This directory is the GitHub handoff channel between mobile ChatGPT and the Mac watcher.

## Queue contract

Edit `queue.json` on `main` with a unique `id`, `status: "approved"`, `project: "oing-toss"`, and the exact Codex instruction in `prompt`.

```json
{
  "id": "2026-08-09-example-001",
  "status": "approved",
  "project": "oing-toss",
  "prompt": "Inspect the project and report the requested information.",
  "createdAt": "2026-08-09T00:00:00Z",
  "requiresPushApproval": true
}
```

The Mac watcher accepts only a previously unseen approved task ID. It writes the outcome to `result.json`, then changes the queue status to `completed` or `failed`.

## Safety contract

- Project code is never committed or pushed automatically.
- Vercel production deployment, force push, rebase, hard reset, destructive commands, and credential storage in the repository are forbidden.
- The watcher stops before execution when the local project has uncommitted changes or when local `main` cannot be fast-forwarded safely.
- GitHub writes are limited to `.codex-bridge/queue.json` and `.codex-bridge/result.json` through the GitHub Contents API. They do not publish project code.
- Task IDs are recorded locally and cannot run twice.
- Prompts and raw Codex logs are not copied to GitHub. Result summaries are redacted before publishing.

`requiresPushApproval` is retained for the mobile workflow, but the bridge never pushes project changes regardless of its value.
