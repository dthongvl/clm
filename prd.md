I want to implement a local code review tool.

## How to start this tool

1. This is a CLI tool, when I'm in a repo, I type 'codereview <PR NUMBER>'
2. It will use `gh` cli tool to fetch the diff
3. It will open a web server at port 3000 and open the browser
4. Browser displays the diff like GitHub code review UI

## The Web UI
- We will display the diff like GitHub code review UI using the diffs.com library
- We will have a right panel to display summary of the AI code review sorted by the critical level (critical, warning, info). Click on the item in the right panel will scroll to the corresponding line in the diff view. Below it is the intelligent diff organization. We will analyzes your code, groups together changes that are logically connected, we will display the information about this group (like summary, list of related files, number of diff lines, etc).
- We will have a top bar to display the PR title, author, etc

## Workflow on the web UI

Workflow 1 (Human review):
- User can click on the line of file to add comment. We will call `gh` tool to submit to the PR
- User can click on the line of file to ask AI more detail about that line. Our tool will trigger the local AI CLI to get the response and display it as a reply comment in the web UI. User can continue to reply to the comment thread to chat with AI.

Workflow 2 (AI review):
- Web server execute local AI CLI binary like Claude Code or Open Code CLI to review the PR.
- The AI CLI will output the file and the line, the critical level, comment. Then we display as a comment in the web UI like workflow 1. User can continue to reply to the comment thread to chat with AI.
- We will also display this AI reviews in the right panel summary.

Workflow 3:
- We also have a global chat popup that user can use to ask question about the PR


## Tech stack

Frontend:
- React + Vite
- Shadcn + Tailwind
- https://github.com/pierrecomputer/pierre/tree/main/packages/diffs (bun i @pierre/diffs) for the diff UI


Backend:
Typescript + Hono run on Bun