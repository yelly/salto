/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { OauthAccessTokenResponse } from '@salto-io/adapter-api'
import supertest from 'supertest'
import waitForExpect from 'wait-for-expect'
import http from 'http'
import * as cliOauthAuthenticator from '../src/cli_oauth_authenticator'
// Importing createServer since this file is the only place it's used but it's only referenced by name for spying
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createServer as _cerateServer } from '../src/cli_oauth_authenticator'
import { MockWriteStream } from './mocks'

let mockWriteStream: MockWriteStream
const createServer = jest.spyOn(cliOauthAuthenticator, 'createServer')

describe('cli oauth server', () => {
  afterEach(async () => {
    await Promise.all(
      createServer.mock.results.map(res => {
        const server = res.value as http.Server
        return new Promise(resolve => server.close(resolve))
      }),
    )
    createServer.mockClear()
  })
  describe('When using the cli oauth authenticates', () => {
    let returnPromise: Promise<OauthAccessTokenResponse>
    beforeEach(async () => {
      mockWriteStream = new MockWriteStream()
      returnPromise = cliOauthAuthenticator.processOauthCredentials(
        8080,
        ['access_token_field', 'instance_url'],
        'testUrl',
        {
          stdout: mockWriteStream,
          stderr: new MockWriteStream(),
        },
      )
    })

    // The actual behavior of the server will be tested in e2e,
    // because it's too specific to tailor a test to. Important thing is that oauth succeeds
    it('should process the credentials through the server', async () => {
      await waitForExpect(() => {
        expect(createServer.mock.results[0].value.address().port).toBeDefined()
      })
      const newLocal = createServer.mock.results.filter(result =>
        result ? result.value.address().port === 8080 : false,
      )
      const app = newLocal[0].value
      await supertest(app)
        .get('/#instance_url=testInstanceUrl&access_token_field=accessTokenThing')
        .expect(response => {
          const responseText = response.text
          expect(responseText).toContain('window.location.replace')
        })
      await supertest(app)
        .get('/extract?instance_url=testInstanceUrl2&access_token_field=accessTokenThing2')
        .expect(response => {
          expect(response.text).toContain('/done')
        })
      await supertest(app)
        .get('/done')
        .expect(response => {
          expect(response.text).toContain('Done configuring Salto')
        })
      const retVal = await returnPromise
      expect(retVal.fields.accessTokenField).toEqual('accessTokenThing2')
      expect(retVal.fields.instanceUrl).toEqual('testInstanceUrl2')
    })
  })

  describe('when oauth output is badly shapen', () => {
    let returnPromise: Promise<OauthAccessTokenResponse>
    beforeEach(async () => {
      mockWriteStream = new MockWriteStream()
      returnPromise = cliOauthAuthenticator.processOauthCredentials(8081, ['testAccessTokenField'], 'testUrl', {
        stdout: mockWriteStream,
        stderr: new MockWriteStream(),
      })
      returnPromise.catch(() => undefined)
    })

    it('Rejects the oauth promise', async () => {
      await waitForExpect(() => {
        expect(createServer.mock.results[0]).not.toBeNull()
      })
      const app = createServer.mock.results.filter(result =>
        result.value.address() ? result.value.address().port === 8081 : false,
      )[0].value
      await supertest(app).get('/extract')
      await expect(returnPromise).rejects.toThrow(new Error('Unexpected oauth response structure'))
    })
  })
})
