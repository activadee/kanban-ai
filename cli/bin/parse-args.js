function parseLauncherArgs(argv) {
  const passThrough = []
  let binaryVersion

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]

    if (arg === '--binary-version') {
      const next = argv[i + 1]
      if (!next || next.startsWith('-')) {
        throw new Error('--binary-version requires a value (e.g. --binary-version 0.4.1)')
      }
      binaryVersion = next
      i += 1
      continue
    }

    if (arg.startsWith('--binary-version=')) {
      const value = arg.slice('--binary-version='.length)
      if (!value) {
        throw new Error('--binary-version requires a value (e.g. --binary-version=0.4.1)')
      }
      binaryVersion = value
      continue
    }

    passThrough.push(arg)
  }

  return { binaryVersion, passThrough }
}

module.exports = { parseLauncherArgs }
