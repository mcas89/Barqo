type PwaUpdateChecker = () => void

const checkers = new Set<PwaUpdateChecker>()

export function subscribePwaUpdateCheck(checker: PwaUpdateChecker) {
  checkers.add(checker)
  return () => {
    checkers.delete(checker)
  }
}

export function requestPwaUpdateCheck() {
  checkers.forEach((checker) => checker())
}
