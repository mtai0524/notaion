---
name: prompt-patterns
description: Reference of proven prompts from the Claude Code team for planning, quality, verification and bug fixing. Use when the user asks for prompt ideas, how to phrase a request, or types /prompt-patterns.
---

# Prompt Patterns

Show the user the pattern that fits their situation; they copy-paste it.

## Planning
1. **Plan first**: `I want to [task]. Research the codebase and create a plan. Do NOT write any code yet.`
2. **Second opinion**: `Review this plan as a skeptical staff engineer. What's missing? What could go wrong? What would you push back on?`
3. **Surface unknowns**: `Make the plan extremely concise. At the end, list unresolved questions to answer before we start.`
4. **Re-plan when stuck**: `This approach isn't working. Stop. Go back to plan mode. What went wrong and what's a better approach?`

## Quality
5. **Demand elegance**: `Knowing everything you know now, scrap this and implement the elegant solution.` — use after a mediocre first attempt.
6. **Claude as reviewer**: `Grill me on these changes and don't make a PR until I pass your test.`
7. **Prove it**: `Prove to me this works. Diff the behavior between main and this branch.`

## Verification
8. **Verify before shipping**: `Now verify your changes work. Run the full test suite, check for type errors, and fix anything that fails.`
9. **Self-improvement**: `Update CLAUDE.md so you don't make that mistake again.` — after every correction.

## Bug fixing
10. **Autonomous fix**: `Go fix the failing CI tests.`
11. **Context dump**: `Here's the bug report from [source]: [paste]. Fix it.`

## Tips
- Plan Mode (Shift+Tab twice) for anything beyond a one-liner.
- Append "use subagents" to throw more compute at a hard problem.
