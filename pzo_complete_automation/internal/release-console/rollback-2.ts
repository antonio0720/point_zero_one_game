function rollback(commits: Commit[], targetCommitIndex: number) {
if (!commits || !Array.isArray(commits)) {
throw new Error("Invalid commits array");
}

let currentIndex = targetCommitIndex;
while (currentIndex < commits.length - 1) {
const nextIndex = currentIndex + 1;
if (compareCommits(commits[nextIndex], commits[nextIndex + 1])) {
const prevState = commits[nextIndex];
commits.splice(currentIndex, commits.length - nextIndex, ...prevState);
break;
}
currentIndex++;
}
}
