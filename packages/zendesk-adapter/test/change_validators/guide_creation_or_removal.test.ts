/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { definitions as definitionsUtils } from '@salto-io/adapter-components'
import ZendeskClient from '../../src/client/client'
import { helpCenterCreationOrRemovalValidator } from '../../src/change_validators'
import { BRAND_TYPE_NAME, ZENDESK } from '../../src/constants'
import { Options } from '../../src/definitions/types'

describe('helpCenterCreationOrRemovalValidator', () => {
  const client = new ZendeskClient({
    credentials: {
      username: 'a',
      password: 'b',
      subdomain: 'ignore',
    },
  })
  const mockedDefinitions = {
    fetch: {
      instances: {
        default: {},
        customizations: {
          brand: {
            element: {
              topLevel: {
                serviceUrl: { path: '/admin/account/brand_management/brands' },
              },
            },
          },
        },
      },
    },
  } as unknown as definitionsUtils.ApiDefinitions<Options>
  const changeValidator = helpCenterCreationOrRemovalValidator(client, mockedDefinitions)

  const BrandType = new ObjectType({
    elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME),
  })

  const brandOneInstance = new InstanceElement('Test1', BrandType, {
    help_center_state: 'enabled',
    has_help_center: true,
    brand_url: 'https://free-tifder.zendesk.com',
  })
  it('should return an error when has_help_center is changed', async () => {
    const brandTwoInstance = new InstanceElement('Test2', BrandType, {
      help_center_state: 'enabled',
      has_help_center: false,
      brand_url: 'https://free-tifder.zendesk.com',
    })
    const errors = await changeValidator([toChange({ before: brandOneInstance, after: brandTwoInstance })])
    expect(errors).toEqual([
      {
        elemID: brandTwoInstance.elemID,
        severity: 'Warning',
        message: 'Creation or removal of help center for a brand is not supported via Salto.',
        // we expect the service url to always exist.
        detailedMessage: `Creation or removal of help center for brand ${brandTwoInstance.elemID.getFullName()} is not supported via Salto.
      To create or remove a help center, please go to ${client.getUrl().href}admin/account/brand_management/brands`,
      },
    ])
  })

  it('should not return an error when has_help_center is not changed', async () => {
    const brandTwoInstance = new InstanceElement('Test2', BrandType, {
      help_center_state: 'enabled',
      has_help_center: true,
      brand_url: 'https://free.zendesk.com',
    })
    const errors = await changeValidator([toChange({ before: brandOneInstance, after: brandTwoInstance })])
    expect(errors).toHaveLength(0)
  })

  it('should return a warning when the change is addition', async () => {
    const errors = await changeValidator([toChange({ after: brandOneInstance })])
    expect(errors).toEqual([
      {
        elemID: brandOneInstance.elemID,
        severity: 'Warning',
        message: 'Creation of a brand with a help center is not supported via Salto.',
        detailedMessage: `Creation of a brand with a help center is not supported via Salto. The brand ${brandOneInstance.elemID.getFullName()} will be created without a help center. After creating the brand, 
            to create a help center, please go to ${client.getUrl().href}admin/account/brand_management/brands`,
      },
    ])
  })

  it('should not return an error when the change is removal', async () => {
    const errors = await changeValidator([toChange({ before: brandOneInstance })])
    expect(errors).toHaveLength(0)
  })

  it('should not return an error when the brand is not valid', async () => {
    const invalidBrandInstance = new InstanceElement('Test1', BrandType, {})
    const errors = await changeValidator([toChange({ after: invalidBrandInstance })])
    expect(errors).toHaveLength(0)
  })
})
