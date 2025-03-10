/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { ElemID, InstanceElement, ObjectType, ReadOnlyElementsSource, toChange } from '@salto-io/adapter-api'
import { MockInterface } from '@salto-io/test-utils'
import { client as clientUtils, filterUtils, definitions } from '@salto-io/adapter-components'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { getFilterParams, mockClient } from '../../utils'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import userFallbackFilter from '../../../src/filters/account_id/user_fallback_filter'
import { JIRA } from '../../../src/constants'

describe('user_fallback_filter', () => {
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let filter: filterUtils.FilterWith<'preDeploy' | 'onDeploy'>
  let config: JiraConfig
  let instance: InstanceElement
  let elementsSource: ReadOnlyElementsSource

  beforeEach(() => {
    const projectType = new ObjectType({
      elemID: new ElemID(JIRA, 'Project'),
    })

    instance = new InstanceElement('instance', projectType, {
      leadAccountId: {
        id: 'notExist',
      },
    })
    const usersType = new ObjectType({
      elemID: new ElemID(JIRA, 'Users'),
    })
    const usersElements = new InstanceElement('users', usersType, {
      users: {
        1: {
          userId: '1',
          username: 'name1',
          displayName: 'disp1',
          locale: 'en_US',
          email: 'email1',
        },
        2: {
          userId: '2',
          username: 'name2',
          displayName: 'disp2',
          locale: 'en_US',
          email: 'email2',
        },
        3: {
          userId: '3',
          username: 'name3',
          displayName: 'disp3',
          locale: 'en_US',
          email: 'email3',
        },
      },
    })
    elementsSource = buildElementsSourceFromElements([usersElements])
  })

  describe('cloud', () => {
    beforeEach(() => {
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
      const { client, paginator, connection } = mockClient()
      mockConnection = connection
      filter = userFallbackFilter(
        getFilterParams({
          client,
          paginator,
          config,
          elementsSource,
        }),
      ) as typeof filter

      mockConnection.get.mockImplementation(async _url => ({
        status: 200,
        data: {
          accountId: '3',
          displayName: 'disp3',
          locale: 'en_US',
          emailAddress: 'email3',
        },
      }))
    })

    it('should replace the account id with the default id if it does not exist', async () => {
      config.deploy.defaultMissingUserFallback = 'email2'
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('2')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    })

    it('should not replace the account id with the default id if it exist', async () => {
      instance.value.leadAccountId.id = '1'
      config.deploy.defaultMissingUserFallback = 'email2'
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('1')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('1')
    })

    it('should replace the account id with the current deployer if requested', async () => {
      config.deploy.defaultMissingUserFallback = definitions.DEPLOYER_FALLBACK_VALUE
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('3')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    })

    it('should not replace the account id with the default if the default not exist', async () => {
      config.deploy.defaultMissingUserFallback = 'email4'
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    })

    it('should not replace the account id when there is no default', async () => {
      config.deploy.defaultMissingUserFallback = undefined
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    })
  })

  describe('datacenter', () => {
    beforeEach(() => {
      config = _.cloneDeep(getDefaultConfig({ isDataCenter: true }))
      const { client, paginator, connection } = mockClient(true)
      mockConnection = connection
      filter = userFallbackFilter(
        getFilterParams({
          client,
          paginator,
          config,
          elementsSource,
        }),
      ) as typeof filter

      mockConnection.get.mockImplementation(async _url => ({
        status: 200,
        data: {
          key: '3',
          name: 'name3',
          displayName: 'disp3',
          locale: 'en_US',
          emailAddress: 'email3',
        },
      }))
    })
    it('should not raise on missing user permission error', async () => {
      config.deploy.defaultMissingUserFallback = 'name2'
      mockConnection.get.mockRejectedValue(new clientUtils.HTTPError('failed', { data: {}, status: 403 }))
      await expect(filter.preDeploy([toChange({ after: instance })])).resolves.not.toThrow()
    })
    it('should replace the account id with the default id if it does not exist', async () => {
      config.deploy.defaultMissingUserFallback = 'name2'
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('name2')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    })

    it('should not replace the account id with the default id if it exist', async () => {
      instance.value.leadAccountId.id = 'name1'
      config.deploy.defaultMissingUserFallback = 'name2'
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('name1')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('name1')
    })

    it('should replace the account id with the current deployer if requested', async () => {
      config.deploy.defaultMissingUserFallback = definitions.DEPLOYER_FALLBACK_VALUE
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('name3')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    })

    it('should not replace the account id with the default if the default not exist', async () => {
      config.deploy.defaultMissingUserFallback = 'name4'
      const change = toChange({ after: instance })
      await filter.preDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
      await filter.onDeploy([change])
      expect(instance.value.leadAccountId.id).toEqual('notExist')
    })
  })
})
