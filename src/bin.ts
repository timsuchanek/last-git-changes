import execa from 'execa'
import chalk from 'chalk'
import path from 'path'
import arg from 'arg'
import micromatch from 'micromatch'

export type Commit = {
  date: Date
  dir: string
  hash: string
  isMergeCommit: boolean
  parentCommits: string[]
}

async function getLatestChanges(dir: string): Promise<string[]> {
  const commit = await getLatestCommit(dir)

  return getChangesFromCommit(commit)
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
    '--help': Boolean,
    '-h': '--help',
  })

  if (args['--help']) {
    console.log(`Usage:
last-git-changes --exclude='README.md,docs' --dir .`)
    process.exit(1)
  }

  const dir = args['--dir'] || './'
  const excludeArg = args['--exclude']
  let exclude = excludeArg && excludeArg.length > 0 ? excludeArg.split(',') : []
  exclude = flatten(exclude.map(prefixStar))

  const changes = await getLatestChanges(dir)
  if (exclude.length === 0) {
    if (changes.length > 0) {
      console.log(changes.join('\n'))
    }
  } else {
    const filteredChanges = micromatch.not(changes, exclude)
    if (filteredChanges.length > 0) {
      console.log(filteredChanges.join('\n'))
    }
  }
}

function flatten<T>(arr: T[][]): T[] {
  return arr.reduce((acc, val) => acc.concat(val), [])
}

// As recommended here https://github.com/micromatch/micromatch/issues/162#issuecomment-507959634
// In order to get the gitignore behavior
function prefixStar(pattern: string): string[] {
  const additionalPattern = `${pattern}/**/*`

  if (pattern.startsWith('**')) {
    return [pattern, additionalPattern]
  }
  if (pattern.startsWith('*')) {
    return ['*' + pattern, additionalPattern]
  }
  return ['**/' + pattern, additionalPattern]
}

main()
