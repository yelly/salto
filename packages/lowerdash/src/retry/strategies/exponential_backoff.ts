/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import defaultOpts from '../../functions/default_opts'
import { validators } from '../../validators'
import { RetryStrategy } from '../strategy'

type ExponentialBackoffOpts = {
  initial: number
  multiplier: number
  max: number
  randomizationFactor: number
  maxElapsed?: number
}

const randomInRange = (minInclusive: number, maxInclusive: number): number =>
  Math.floor(minInclusive + Math.random() * (maxInclusive - minInclusive + 1))

export default defaultOpts(
  (opts: ExponentialBackoffOpts): RetryStrategy => {
    let interval = opts.initial
    const cutoffTime = opts.maxElapsed && Date.now() + opts.maxElapsed

    return () => {
      if (cutoffTime !== undefined && Date.now() >= cutoffTime) {
        return `max elapsed time ${opts.maxElapsed} exceeded`
      }
      const delta = opts.randomizationFactor * interval
      const minInterval = interval - delta
      const maxInterval = interval + delta
      const result = randomInRange(minInterval, maxInterval)
      interval = interval >= opts.max / opts.multiplier ? opts.max : interval * opts.multiplier
      return result
    }
  },
  {
    initial: 250,
    multiplier: 1.5,
    max: 30000,
    randomizationFactor: 0.5,
    maxElapsed: 90000,
  },
  {
    initial: validators.greaterThan(0),
    multiplier: validators.greaterOrEqualThan(1),
    randomizationFactor: validators.inRangeInclusive()([0, 1]),
    max: validators.greaterOrEqualThan(o => o.initial),
    maxElapsed: validators.undefinedOr(validators.greaterThan(0)),
  },
)
