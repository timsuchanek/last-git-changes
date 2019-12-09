# `last-git-changes`

Prints the changed files of the last git commit, including globbing support with exlude patterns and correctly resolves merge commits. Useful in CI environments, when certain folders should be ignored.

## Usage

```bash
$ npm install -g last-git-changes
$ last-git-changes --exclude='README.md,docs'
file1
file2
file3
```

## License

MIT
