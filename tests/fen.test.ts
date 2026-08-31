import { describe, expect, test } from 'vitest'
import { validateFen } from '../node_modules/@west-shell/xiangqi.js/src/fen'

const DEFAULT_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1'

describe('FEN基础格式检查', () => {
  test('标准开局FEN合法', () => {
    expect(validateFen(DEFAULT_FEN)).toEqual({ ok: true })
  })

  test('字段数量不合法 - 7字段', () => {
    const result = validateFen('rnbakabnr/9/9/9/9/9/9/9/9/rnbakabnr w - - 0 1 x')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('1 to 6')
  })

  test('最小FEN(仅盘面)合法', () => {
    const result = validateFen('5k3/9/9/9/9/9/9/9/9/3K5')
    expect(result.ok).toBe(true)
  })

  test('行棋方不合法', () => {
    const result = validateFen('rnbakabnr/9/9/9/9/9/9/9/9/rnbakabnr x - - 0 1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('side-to-move')
  })

  test('易位字段不为-', () => {
    const result = validateFen('rnbakabnr/9/9/9/9/9/9/9/9/rnbakabnr w Kk - 0 1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('castling')
  })

  test('过路兵字段不为-', () => {
    const result = validateFen('rnbakabnr/9/9/9/9/9/9/9/9/rnbakabnr w - e3 0 1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('en-passant')
  })

  test('行数不为10', () => {
    const result = validateFen('rnbakabnr/9/9/9/9/9/9/9/rnbakabnr w - - 0 1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('10')
  })

  test('每行列数不为9', () => {
    const result = validateFen('rnbakabnr/8/9/9/9/9/9/9/9/rnbakabnr w - - 0 1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('too many squares')
  })

  test('连续数字非法', () => {
    const result = validateFen('rnbakabnr/9/1c5c1/p1p1p1p1p/9/22/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('consecutive number')
  })

  test('非法棋子字符', () => {
    const result = validateFen('rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNzAKABNR w - - 0 1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('invalid piece')
  })

  test('缺少红方将', () => {
    const result = validateFen('rnbakabnr/9/9/9/9/9/9/9/9/rnba1abnr w - - 0 1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('missing red king')
  })

  test('缺少黑方帅', () => {
    const result = validateFen('rnba1abnr/9/9/9/9/9/9/9/9/RNBAKABNR w - - 0 1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('missing black king')
  })

  test('红方多个将', () => {
    const result = validateFen('rnbakabnr/9/9/9/9/9/9/9/K8/RNBAKABNR w - - 0 1')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('too many red kings')
  })
})

describe('FEN仕的位置检查', () => {
  test('红仕在合法点位 (3,9) - d10', () => {
    const fen = '5k3/9/9/9/9/9/9/9/4K4/3A5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('红仕在合法点位 (5,9) - f10', () => {
    const fen = '5k3/9/9/9/9/9/9/9/9/3K1A3'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('红仕在合法点位 (4,8) - e9', () => {
    const fen = '5k3/9/9/9/9/9/9/9/4A4/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('红仕在合法点位 (3,7) - d8', () => {
    const fen = '5k3/9/9/9/9/9/9/3A5/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('红仕在合法点位 (5,7) - f8', () => {
    const fen = '5k3/9/9/9/9/9/9/5A3/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('红仕在宫内非法点位 (4,7) - e8不在斜线上', () => {
    const fen = '5k3/9/9/9/9/9/9/4A4/9/3K5'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('red advisor')
  })

  test('红仕在宫内非法点位 (4,9) - e10不在斜线上', () => {
    const fen = '5k3/9/9/9/9/9/9/9/4K4/4A4'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('red advisor')
  })

  test('红仕在宫外 (2,7) - c8', () => {
    const fen = '5k3/9/9/9/9/9/9/2A6/9/3K5'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('red advisor')
  })

  test('黑士在合法点位 (3,0) - d1', () => {
    const fen = '3a1k3/9/9/9/9/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('黑士在合法点位 (5,0) - f1', () => {
    const fen = '4ka3/9/9/9/9/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('黑士在合法点位 (4,1) - e2', () => {
    const fen = '5k3/4a4/9/9/9/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('黑士在合法点位 (3,2) - d3', () => {
    const fen = '5k3/9/3a5/9/9/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('黑士在合法点位 (5,2) - f3', () => {
    const fen = '5k3/9/5a3/9/9/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('黑士在宫内非法点位 (4,0) - e1不在斜线上', () => {
    const fen = '4a1k2/9/9/9/9/9/9/9/9/3K5'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('black advisor')
  })

  test('黑士在宫内非法点位 (4,2) - e3不在斜线上', () => {
    const fen = '5k3/9/4a4/9/9/9/9/9/9/3K5'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('black advisor')
  })

  test('黑士在宫外 (2,2) - c3', () => {
    const fen = '5k3/9/2a6/9/9/9/9/9/9/3K5'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('black advisor')
  })
})

describe('FEN象的位置检查', () => {
  test('红相在合法点位 (2,9) - c10', () => {
    const fen = '5k3/9/9/9/9/9/9/9/9/2B1K4'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('红相在合法点位 (6,9) - g10', () => {
    const fen = '5k3/9/9/9/9/9/9/9/9/3K2B2'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('红相在合法点位 (0,7) - a8', () => {
    const fen = '5k3/9/9/9/9/9/9/B8/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('红相在合法点位 (4,7) - e8', () => {
    const fen = '5k3/9/9/9/9/9/9/4B4/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('红相在合法点位 (8,7) - i8', () => {
    const fen = '5k3/9/9/9/9/9/9/8B/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('红相在合法点位 (2,5) - c6', () => {
    const fen = '5k3/9/9/9/9/2B6/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('红相在合法点位 (6,5) - g6', () => {
    const fen = '5k3/9/9/9/9/6B2/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('红相在非法点位 (3,7) - d8不是田字对角', () => {
    const fen = '5k3/9/9/9/9/9/9/3B5/9/3K5'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('red elephant')
  })

  test('红相在非法点位 (4,5) - e6不是田字对角', () => {
    const fen = '5k3/9/9/9/9/4B4/9/9/9/3K5'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('red elephant')
  })

  test('红相过河 (2,3) - c4', () => {
    const fen = '5k3/9/9/2B6/9/9/9/9/9/3K5'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('red elephant')
  })

  test('黑象在合法点位 (2,0) - c1', () => {
    const fen = '2b2k3/9/9/9/9/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('黑象在合法点位 (6,0) - g1', () => {
    const fen = '5kb2/9/9/9/9/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('黑象在合法点位 (0,2) - a3', () => {
    const fen = '5k3/9/b8/9/9/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('黑象在合法点位 (4,2) - e3', () => {
    const fen = '5k3/9/4b4/9/9/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('黑象在合法点位 (8,2) - i3', () => {
    const fen = '5k3/9/8b/9/9/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('黑象在合法点位 (2,4) - c5', () => {
    const fen = '5k3/9/9/9/2b6/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('黑象在合法点位 (6,4) - g5', () => {
    const fen = '5k3/9/9/9/6b2/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('黑象在非法点位 (3,2) - d3不是田字对角', () => {
    const fen = '5k3/9/3b5/9/9/9/9/9/9/3K5'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('black elephant')
  })

  test('黑象过河 (2,5) - c6', () => {
    const fen = '5k3/9/9/9/9/2b6/9/9/9/3K5'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('black elephant')
  })

  test('象别名E在非法点位 - 检查位置', () => {
    const fen = '5k3/9/9/9/9/9/9/3E5/9/3K5'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('red elephant')
  })

  test('象别名e在非法点位 - 检查位置', () => {
    const fen = '5k3/9/3e5/9/9/9/9/9/9/3K5'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('black elephant')
  })

  test('象别名E在合法点位 (4,7)', () => {
    const fen = '5k3/9/9/9/9/9/9/4E4/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('象别名e在合法点位 (4,2)', () => {
    const fen = '5k3/9/4e4/9/9/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })
})

describe('FEN将帅对脸检查', () => {
  test('将帅同列无阻挡 - 非法', () => {
    const fen = '4k4/9/9/9/9/9/9/9/9/4K4'
    const result = validateFen(fen)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('flying general')
  })

  test('将帅同列有棋子阻挡 - 合法', () => {
    const fen = '4k4/9/9/9/9/4R4/9/9/9/4K4'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('将帅不同列 - 合法', () => {
    const fen = '5k3/9/9/9/9/9/9/9/9/3K5'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('将帅同列多个阻挡子 - 合法', () => {
    const fen = '4k4/9/9/4P4/9/9/4r4/9/9/4K4'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('将帅同列仅一个子紧贴将 - 合法', () => {
    const fen = '4k4/4r4/9/9/9/9/9/9/9/4K4'
    expect(validateFen(fen)).toEqual({ ok: true })
  })

  test('标准开局不将对脸 - 合法', () => {
    expect(validateFen(DEFAULT_FEN)).toEqual({ ok: true })
  })
})
