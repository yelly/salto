/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { getFilterParams } from '../utils'
import avatarsFilter from '../../src/filters/avatars'
import { Filter } from '../../src/filter'
import { JIRA } from '../../src/constants'

describe('avatarsFilter', () => {
  let filter: Filter
  let type: ObjectType
  let issueTypeType: ObjectType
  beforeEach(async () => {
    filter = avatarsFilter(getFilterParams())

    type = new ObjectType({
      elemID: new ElemID(JIRA, 'type'),
    })
    issueTypeType = new ObjectType({
      elemID: new ElemID(JIRA, 'IssueType'),
    })
  })

  describe('onFetch', () => {
    it('should remove avatar', async () => {
      const avatarsInstance = new InstanceElement('instance', type, {
        avatarUrls: {
          '48x48': 'https://ori-salto-test.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10303',
          '24x24':
            'https://ori-salto-test.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10303?size=small',
          '16x16':
            'https://ori-salto-test.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10303?size=xsmall',
          '32x32':
            'https://ori-salto-test.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10303?size=medium',
        },
      })
      await filter.onFetch?.([avatarsInstance])
      expect(avatarsInstance.value).toEqual({})
    })
    it('should remove icons on IssueType elements', async () => {
      const iconInstance = new InstanceElement('instance', issueTypeType, {
        iconUrl:
          'https://ori-salto-test.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10303?size=medium',
      })
      await filter.onFetch?.([iconInstance])
      expect(iconInstance.value).toEqual({})
    })
    it('should remove avatar and relevant icons in nested fields', async () => {
      const iconInstance = new InstanceElement('instance', issueTypeType, {
        nested: {
          iconUrl:
            'https://ori-salto-test.atlassian.net/rest/api/2/universal_avatar/view/type/issuetype/avatar/10303?size=medium',
        },
      })

      const avatarsInstance = new InstanceElement('instance', type, {
        otherNested: {
          avatarUrls: {
            '48x48': 'https://ori-salto-test.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10303',
            '24x24':
              'https://ori-salto-test.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10303?size=small',
            '16x16':
              'https://ori-salto-test.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10303?size=xsmall',
            '32x32':
              'https://ori-salto-test.atlassian.net/rest/api/3/universal_avatar/view/type/project/avatar/10303?size=medium',
          },
        },
      })

      await filter.onFetch?.([iconInstance, avatarsInstance])

      expect(iconInstance.value).toEqual({ nested: {} })

      expect(avatarsInstance.value).toEqual({ otherNested: {} })
    })
    it('if url starts with base url should remove the domain prefix', async () => {
      const iconInstance = new InstanceElement('instance', type, {
        iconUrl: 'https://ori-salto-test.atlassian.net/images/icons/priorities/low.svg?size=medium',
      })
      await filter.onFetch?.([iconInstance])

      expect(iconInstance.value).toEqual({
        iconUrl: '/images/icons/priorities/low.svg?size=medium',
      })
    })

    it('if url does not start with the domain prefix should not change it', async () => {
      const iconInstance = new InstanceElement('instance', type, {
        iconUrl: 'https://other/images/icons/priorities/low.svg?size=medium',
      })

      await filter.onFetch?.([iconInstance])

      expect(iconInstance.value).toEqual({
        iconUrl: 'https://other/images/icons/priorities/low.svg?size=medium',
      })
    })
  })
})
