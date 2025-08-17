import { describe, test, expect } from 'vitest'
import { PGNParser } from './parser'

describe('中国象棋PGN解析器', () => {
  test('解析简单着法序列', () => {
    const pgn = `
      [Event "测试棋局"]
      1. H2-E2 H7-E7
      2. I0-H0 B7-C7
    `

    const parser = new PGNParser(pgn)
    const gameTree = parser.getRoot()
    // 验证根节点
    expect(gameTree.id).toBe('node-root')
    expect(gameTree.children).toHaveLength(1)

    // 验证第一步(红方)
    const move1 = gameTree.children[0]
    expect(move1.data?.ICCS).toBe('H2-E2')
    expect(move1.side).toBe('red')
    expect(move1.step).toBe(1)
    expect(move1.children).toHaveLength(1)

    // 验证第一步(黑方)
    const move2 = move1.children[0]
    expect(move2.data?.ICCS).toBe('H7-E7')
    expect(move2.side).toBe('black')
    expect(move2.step).toBe(2)
  })

  test('解析带注释的着法', () => {
    const pgn = `
          1. H2-E2 {这是关键着法} H7-E7
          2. I0-H0  B7-C7
        `
    const parser = new PGNParser(pgn)
    const gameTree = parser.getRoot()

    const redMove = gameTree.children[0]
    expect(redMove.comments).toEqual(['这是关键着法'])

    const blackMove = redMove.children[0]
    expect(blackMove.comments).toEqual([])
  })

  test('解析分支变化', () => {
    const pgn = `
          1. H2-E2 (1. G0-E2 {变着} G6-E5) H7-E7
        `
    const parser = new PGNParser(pgn)
    const gameTree = parser.getRoot()
    const mainLine = gameTree.children[0]

    expect(mainLine.data?.ICCS).toBe('H2-E2')
    expect(mainLine.children).toHaveLength(1) // 主线和变着

    const variation = gameTree.children[1]
    expect(variation.children).toHaveLength(1)

    expect(variation.data?.ICCS).toBe('G0-E2')
    expect(variation.comments).toEqual(['变着'])
  })

  test('解析中文着法(WXF)', () => {
    const pgn = '1. 炮二平五 马8进7'
    const parser = new PGNParser(pgn)
    const gameTree = parser.getRoot()

    const redMove = gameTree.children[0]
    expect(redMove.data?.WXF).toBe('炮二平五')

    const blackMove = redMove.children[0]
    expect(blackMove.data?.WXF).toBe('马8进7')
  })

})
