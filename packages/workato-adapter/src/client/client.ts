/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { client as clientUtils, definitions } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { createConnection } from './connection'
import { WORKATO } from '../constants'
import { Credentials } from '../auth'

const {
  DEFAULT_RETRY_OPTS,
  DEFAULT_TIMEOUT_OPTS,
  RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  RATE_LIMIT_DEFAULT_OPTIONS,
} = clientUtils
const log = logger(module)

const DEFAULT_MAX_CONCURRENT_API_REQUESTS: Required<definitions.ClientRateLimitConfig> = {
  total: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
  // this is arbitrary, could not find official limits
  get: 10,
  deploy: 10,
}

const DEFAULT_PAGE_SIZE: Required<definitions.ClientPageSizeConfig> = {
  get: 10,
}

export default class WorkatoClient extends clientUtils.AdapterHTTPClient<
  Credentials,
  definitions.ClientRateLimitConfig
> {
  constructor(clientOpts: clientUtils.ClientOpts<Credentials, definitions.ClientRateLimitConfig>) {
    super(WORKATO, clientOpts, createConnection, {
      pageSize: DEFAULT_PAGE_SIZE,
      rateLimit: DEFAULT_MAX_CONCURRENT_API_REQUESTS,
      maxRequestsPerMinute: RATE_LIMIT_UNLIMITED_MAX_CONCURRENT_REQUESTS,
      delayPerRequestMS: RATE_LIMIT_DEFAULT_OPTIONS.delayMS,
      useBottleneck: RATE_LIMIT_DEFAULT_OPTIONS.useBottleneck,
      retry: DEFAULT_RETRY_OPTS,
      timeout: DEFAULT_TIMEOUT_OPTS,
    })
  }

  public async get(
    args: clientUtils.ClientBaseParams,
  ): Promise<clientUtils.Response<clientUtils.ResponseValue | clientUtils.ResponseValue[]>> {
    try {
      return await super.get(args)
    } catch (e) {
      const status = e.response?.status
      // Workato returns 400 when asking to get pages from non-Dev Workato-Environments (Production/test)
      if (status === 400 && ['/roles'].includes(args.url)) {
        log.warn('Suppressing %d error %o', status, e)
        return { data: [], status }
      }
      throw e
    }
  }
}
