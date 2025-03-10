/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { chunkByEvenly, weightedChunks } from '../src/chunks'

describe('weightedChunks', () => {
  it('should split chunks correctly when first chunk is smaller than max size', () => {
    const chunks = weightedChunks(['a', 'bb', 'cccc', 'dddddd', 'eeeeeeeeee'], 7, val => val.length)
    expect(chunks).toEqual([['a', 'bb', 'cccc'], ['dddddd'], ['eeeeeeeeee']])
  })
  it('should split chunks correctly when first chunk is larger than max size', () => {
    const chunks = weightedChunks(['eeeeeeeeee', 'dddddd', 'cccc', 'bb', 'a'], 7, val => val.length)
    expect(chunks).toEqual([['eeeeeeeeee'], ['dddddd'], ['cccc', 'bb', 'a']])
  })
  it('should split chunks correctly with max items per chunk limitation', () => {
    const chunks = weightedChunks(['eeeeeeeeee', 'dddddd', 'cccc', 'bb', 'a'], 7, val => val.length, 2)
    expect(chunks).toEqual([['eeeeeeeeee'], ['dddddd'], ['cccc', 'bb'], ['a']])
  })
})

describe('chunkByEvenly', () => {
  const sum = (items: number[]): number => items.reduce((partialSum, next) => partialSum + next, 0)
  it('should not surpass the hard limit when all items are below the limit', () => {
    const limit = 6
    const chunks = chunkByEvenly([1, 6, 3, 4, 1, 5, 2, 4, 6], limit, item => item)
    chunks.map(sum).forEach(chunkSize => {
      expect(chunkSize).toBeLessThanOrEqual(limit)
    })
  })
  it('should chunk such that all groups are roughly the same size if possible', () => {
    const limit = 12
    const chunks = chunkByEvenly([1, 2, 3, 2, 3, 5, 2, 6, 1], limit, item => item)
    expect(chunks.map(sum)).toEqual([8, 8, 9])
  })
})
