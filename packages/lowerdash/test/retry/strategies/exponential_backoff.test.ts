/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { RetryStrategy } from '../../../src/retry/strategies'
import exponentialBackoff from '../../../src/retry/strategies/exponential_backoff'

describe('exponentialBackoff', () => {
  let subject: RetryStrategy
  let now: number

  const times = <T>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }).map((_, i) => f(i))

  const RANDOM_RESULT = 0.1
  beforeEach(() => {
    now = Date.now()
    jest.spyOn(Math, 'random').mockImplementation(() => RANDOM_RESULT)
    jest.spyOn(Date, 'now').mockImplementation(() => now)
  })

  describe('when no opts are specified', () => {
    beforeEach(() => {
      subject = exponentialBackoff()
    })

    it('should return the correct results', () => {
      const expected = [
        150,
        225,
        337,
        506,
        759,
        1139,
        1708,
        2562,
        3844,
        5766,
        8649,
        12974,
        18000,
        18000,
        18000,
        'max elapsed time 90000 exceeded',
        'max elapsed time 90000 exceeded',
      ]
      expect(
        times(expected.length, () => {
          const result = subject()
          if (typeof result === 'number') now += result
          return result
        }),
      ).toEqual(expected)
    })
  })

  describe('when opts are specified', () => {
    beforeEach(() => {
      subject = exponentialBackoff({
        initial: 1000,
        multiplier: 1.2,
      })
    })

    it('should return the correct results', () => {
      const expected = [
        600,
        720,
        864,
        1036,
        1244,
        1493,
        1791,
        2150,
        2579,
        3095,
        3715,
        4458,
        5349,
        6419,
        7703,
        9244,
        11093,
        13311,
        15974,
        'max elapsed time 90000 exceeded',
        'max elapsed time 90000 exceeded',
      ]
      expect(
        times(expected.length, () => {
          const result = subject()
          if (typeof result === 'number') now += result
          return result
        }),
      ).toEqual(expected)
    })
  })
})
