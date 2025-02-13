/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, isInstanceElement, ObjectType } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import _ from 'lodash'
import { PRIVATE_API_HEADERS } from '../../../src/client/headers'
import JiraClient from '../../../src/client/client'
import { getDefaultConfig, JiraConfig } from '../../../src/config/config'
import { JIRA, WORKFLOW_RULES_TYPE_NAME, WORKFLOW_TYPE_NAME } from '../../../src/constants'
import triggersFilter from '../../../src/filters/workflow/triggers_filter'
import { getFilterParams, mockClient } from '../../utils'

describe('triggersFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let workflowType: ObjectType
  let workflowRulesType: ObjectType
  let client: JiraClient
  let mockConnection: MockInterface<clientUtils.APIConnection>
  let config: JiraConfig
  beforeEach(async () => {
    workflowType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_TYPE_NAME) })
    workflowRulesType = new ObjectType({ elemID: new ElemID(JIRA, WORKFLOW_RULES_TYPE_NAME) })

    const { client: cli, paginator, connection } = mockClient()
    client = cli
    mockConnection = connection

    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    filter = triggersFilter(
      getFilterParams({
        client,
        paginator,
        config,
      }),
    ) as typeof filter
  })

  describe('onFetch', () => {
    it('should add triggers field to the type', async () => {
      const elements = [workflowRulesType]
      await filter.onFetch(elements)
      expect(elements).toHaveLength(2)
      expect(workflowRulesType.fields.triggers).toBeDefined()
    })

    it('should add triggers value to instances', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        name: 'name',
        transitionIds: { '4-5-transition1': '1' },
        transitions: {
          tran1: { id: '1', name: 'transition1', from: ['4', '5'] },
        },
      })

      mockConnection.get.mockResolvedValue({
        status: 200,
        data: [
          {
            id: '1',
            key: 'key',
            configuration: {},
          },
        ],
      })
      await filter.onFetch([instance])

      expect(mockConnection.get).toHaveBeenCalledWith('/rest/triggers/1.0/workflow/config', {
        params: {
          workflowName: 'name',
          actionId: '1',
        },
        headers: PRIVATE_API_HEADERS,
      })
      expect(instance.value.transitions.tran1.rules.triggers).toEqual([
        {
          key: 'key',
          configuration: {},
        },
      ])
    })

    it('should remove workflow if failed to get triggers', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        name: 'name',
        transitionIds: { '4-5-transition1': '1' },
        transitions: {
          tran1: { id: '1', name: 'transition1', from: ['4', '5'] },
        },
      })

      mockConnection.get.mockRejectedValue(new Error())
      const elements = [instance]
      await filter.onFetch(elements)
      expect(elements.filter(isInstanceElement)).toHaveLength(0)
    })

    it('do nothing if transition id not found', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        name: 'name',
        transitions: [{ name: 'transition1', from: ['4', '5'] }],
      })

      await filter.onFetch([instance])

      expect(mockConnection.get).not.toHaveBeenCalled()
      expect(instance.value).toEqual({
        name: 'name',
        transitions: [{ name: 'transition1', from: ['4', '5'] }],
      })
    })

    it('do nothing when there are no transitions', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        name: 'name',
      })

      await filter.onFetch([instance])

      expect(mockConnection.get).not.toHaveBeenCalled()
      expect(instance.value).toEqual({
        name: 'name',
      })
    })

    it('do nothing if response is invalid', async () => {
      const instance = new InstanceElement('instance', workflowType, {
        name: 'name',
        transitionIds: { '4-5-transition1': '1' },
        transitions: [{ id: '1', name: 'transition1', from: ['4', '5'] }],
      })

      mockConnection.get.mockResolvedValue({
        status: 200,
        data: {},
      })

      await filter.onFetch([instance])

      expect(instance.value).toEqual({
        name: 'name',
        transitionIds: { '4-5-transition1': '1' },
        transitions: [{ id: '1', name: 'transition1', from: ['4', '5'] }],
      })
    })

    it('do nothing if usePrivateApi is false', async () => {
      config.client.usePrivateAPI = false

      const instance = new InstanceElement('instance', workflowType, {
        name: 'name',
        transitionIds: { '4-5-transition1': '1' },
        transitions: [{ id: '1', name: 'transition1', from: ['4', '5'] }],
      })

      await filter.onFetch([instance])

      expect(mockConnection.get).not.toHaveBeenCalled()
      expect(instance.value).toEqual({
        name: 'name',
        transitionIds: { '4-5-transition1': '1' },
        transitions: [{ id: '1', name: 'transition1', from: ['4', '5'] }],
      })
    })
  })
})
