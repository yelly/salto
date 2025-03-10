/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import ZendeskClient from '../../../src/client/client'
import { deleteTheme } from '../../../src/filters/guide_themes/delete'

describe('create', () => {
  let client: ZendeskClient
  let mockDelete: jest.SpyInstance

  beforeEach(() => {
    client = new ZendeskClient({
      credentials: { username: 'a', password: 'b', subdomain: 'ignore' },
    })
    mockDelete = jest.spyOn(client, 'delete')
  })

  describe('successful flow', () => {
    describe('no errors', () => {
      beforeEach(() => {
        mockDelete.mockResolvedValue({
          status: 204,
        })
      })

      it('returns no errors when successful', async () => {
        expect(await deleteTheme('1', client)).toEqual([])
        expect(mockDelete).toHaveBeenCalledTimes(1)
        expect(mockDelete).toHaveBeenCalledWith({
          url: '/api/v2/guide/theming/themes/1',
        })
      })
    })

    describe('with errors', () => {
      beforeEach(() => {
        mockDelete.mockResolvedValue({
          status: 400,
        })
      })

      it('returns an errors', async () => {
        expect(await deleteTheme('1', client)).toEqual(['Failed to delete theme 1. Received status code 400'])
      })
    })
  })
})
