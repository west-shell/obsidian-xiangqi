function getMatrixDict(tree) {
  let matrix = [...Array(tree.getHeight() + 1)].map(_ => [])
  let dict = {}

  let inner = (node, matrix, dict, xshift, yshift) => {
    let sequence = [...tree.getSequence(node.id)]
    let hasCollisions = true

    while (hasCollisions) {
      hasCollisions = false

      for (let y = 0; y <= sequence.length; y++) {
        if (xshift >= matrix[yshift + y].length - (y === sequence.length))
          continue

        hasCollisions = true
        xshift++
        break
      }
    }

    for (let y = 0; y < sequence.length; y++) {
      matrix[yshift + y][xshift] = sequence[y].id
      dict[sequence[y].id] = [xshift, yshift + y]
    }

    let lastSequenceNode = sequence.slice(-1)[0]

    for (let k = 0; k < lastSequenceNode.children.length; k++) {
      let child = lastSequenceNode.children[k]
      inner(child, matrix, dict, xshift + k, yshift + sequence.length)
    }

    return [matrix, dict]
  }

  return inner(tree.root, matrix, dict, 0, 0)
}