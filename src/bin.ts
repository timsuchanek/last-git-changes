import execa from 'execa'
import chalk from 'chalk'
import path from 'path'
import arg from 'arg'

export type Commit = {
  date: Date
  dir: string
  hash: string
  isMergeCommit: boolean
  parentCommits: string[]
}

async function getLatestCommit(dir: string): Promise<Commit> {
  const result = await runResult(
    dir,
    'git log --pretty=format:"%ad %H %P" --date=iso-strict -n 1',
  )
  const [date, commit, ...parents] = result.split(' ')

  return {
    date: new Date(date),
    dir,
    hash: commit,
    isMergeCommit: parents.length > 1,
    parentCommits: parents,
  }
}
/**
 * Runs a command and returns the resulting stdout in a Promise.
 * @param cwd cwd for running the command
 * @param cmd command to run
 */
async function runResult(cwd: string, cmd: string): Promise<string> {
  try {
    const result = await execa.command(cmd, {
      cwd,
      stdio: 'pipe',
      shell: true,
    })
    return result.stdout
  } catch (e) {
    throw new Error(
      chalk.red(
        `Error running ${chalk.bold(cmd)} in ${chalk.underline(cwd)}:`,
      ) + (e.stderr || e.stack || e.message),
    )
  }
}

async function getChangesFromCommit(commit: Commit): Promise<string[]> {
  const hashes = commit.isMergeCommit
    ? commit.parentCommits.join(' ')
    : commit.hash
  const changes = await runResult(
    commit.dir,
    `git diff-tree --no-commit-id --name-only -r ${hashes}`,
  )
  if (changes.trim().length > 0) {
    return changes.split('\n').map(change => path.join(commit.dir, change))
  } else {
    throw new Error(`No changes detected. This must not happen!`)
  }
}

async function main() {
  const args = arg({
    '--dir': String,
    '--exclude': String,
  })

  if (!args['--exclude']) {
    console.log(`Usage:
last-git-changes --exclude='README.md,docs' --dir .`)
    process.exit(1)
  }
}

main()