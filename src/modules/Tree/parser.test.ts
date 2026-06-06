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
    expect(gameTree.id).toBe('node-root')
    expect(gameTree.children).toHaveLength(1)

    const move1 = gameTree.children[0]
    expect(move1.move?.zh).toBeTruthy()
    expect(move1.side).toBe('red')
    expect(move1.step).toBe(1)
    expect(move1.children).toHaveLength(1)
    expect(move1.fen).toBeTruthy()

    const move2 = move1.children[0]
    expect(move2.move?.zh).toBeTruthy()
    expect(move2.side).toBe('black')
    expect(move2.step).toBe(2)
    expect(move2.fen).toBeTruthy()
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
      1. H2-E2 (H0-G2 {变着}) H7-E7
    `
    const parser = new PGNParser(pgn)
    const gameTree = parser.getRoot()
    const mainLine = gameTree.children[0]

    expect(mainLine.move?.zh).toBeTruthy()
    expect(mainLine.children).toHaveLength(1)

    expect(gameTree.children.length).toBeGreaterThan(1)
    const variation = gameTree.children[1]
    expect(variation.move?.zh).toBeTruthy()
    expect(variation.comments).toEqual(['变着'])
  })
})
