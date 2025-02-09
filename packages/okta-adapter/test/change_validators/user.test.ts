/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { DEFAULT_CONFIG } from '../../src/user_config'
import { usersValidator } from '../../src/change_validators/user'
import { OKTA, GROUP_RULE_TYPE_NAME, ACCESS_POLICY_RULE_TYPE_NAME } from '../../src/constants'
import OktaClient from '../../src/client/client'
import { OMIT_MISSING_USERS_CONFIGURATION_LINK } from '../../src/user_utils'
import { createFetchQuery } from '../utils'

describe('usersValidator', () => {
  const fetchQuery = createFetchQuery()
  const client = new OktaClient({
    credentials: { baseUrl: 'a.okta.com', token: 'token' },
  })
  const mockGet = jest.spyOn(client, 'get')
  const ruleType = new ObjectType({ elemID: new ElemID(OKTA, GROUP_RULE_TYPE_NAME) })
  const accessRuleType = new ObjectType({ elemID: new ElemID(OKTA, ACCESS_POLICY_RULE_TYPE_NAME) })
  const policyInstance = new InstanceElement('somePolicy', accessRuleType, {
    name: 'policy',
    conditions: { people: { users: { exclude: ['a@a', 'e@e'], include: ['z@z'] } } },
  })
  const ruleInstance = new InstanceElement('groupRule', ruleType, {
    name: 'rule',
    conditions: { people: { users: { exclude: ['e@e', 'b@b'] } }, expression: { value: 'something' } },
  })
  const message = "Instance references users which don't exist in target environment"

  beforeEach(async () => {
    jest.clearAllMocks()
  })

  it('should return error when change include users that does not exist', async () => {
    mockGet.mockResolvedValue({
      status: 200,
      data: [
        { id: '1', profile: { login: 'a@a' } },
        { id: '2', profile: { login: 'b@b' } },
        { id: '3', profile: { login: 'c@c' } },
        { id: '4', profile: { login: 'd@d' } },
      ],
    })
    const changeValidator = usersValidator(client, DEFAULT_CONFIG, fetchQuery)
    const changeErrors = await changeValidator([
      toChange({ before: policyInstance, after: policyInstance }),
      toChange({ after: ruleInstance }),
    ])
    expect(changeErrors).toHaveLength(2)
    expect(changeErrors).toEqual([
      {
        elemID: policyInstance.elemID,
        severity: 'Error',
        message,
        detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: e@e, z@z.\nIn order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames or configure omitMissingUsers: ${OMIT_MISSING_USERS_CONFIGURATION_LINK}`,
      },
      {
        elemID: ruleInstance.elemID,
        severity: 'Error',
        message,
        detailedMessage: `The following users are referenced by this instance, but do not exist in the target environment: e@e.\nIn order to deploy this instance, add these users to your target environment, edit this instance to use valid usernames or configure omitMissingUsers: ${OMIT_MISSING_USERS_CONFIGURATION_LINK}`,
      },
    ])
  })
  it('should not return errors if all users in instance exists', async () => {
    mockGet.mockResolvedValue({
      status: 200,
      data: [
        { id: '1', profile: { login: 'a@a' } },
        { id: '2', profile: { login: 'b@b' } },
        { id: '3', profile: { login: 'c@c' } },
        { id: '4', profile: { login: 'd@d' } },
        { id: '5', profile: { login: 'e@e' } },
        { id: '6', profile: { login: 'z@z' } },
      ],
    })
    const changeValidator = usersValidator(client, DEFAULT_CONFIG, fetchQuery)
    const changeErrors = await changeValidator([
      toChange({ before: policyInstance, after: policyInstance }),
      toChange({ after: ruleInstance }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
  it('should do nothing if convertUsersIds config flag is disabled', async () => {
    const changeValidator = usersValidator(
      client,
      {
        ...DEFAULT_CONFIG,
        fetch: { include: [], exclude: [], convertUsersIds: false },
      },
      fetchQuery,
    )
    const changeErrors = await changeValidator([
      toChange({ before: policyInstance, after: policyInstance }),
      toChange({ after: ruleInstance }),
    ])
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error if users path does not exist', async () => {
    mockGet.mockResolvedValue({
      status: 200,
      data: [{ id: '1', profile: { login: 'a@a' } }],
    })
    const changeValidator = usersValidator(client, DEFAULT_CONFIG, fetchQuery)
    const instance = new InstanceElement('no users', accessRuleType, {
      name: 'policy',
      conditions: { people: { groups: { include: ['groupId'] } } },
    })
    const changeErrors = await changeValidator([toChange({ after: instance })])
    expect(changeErrors).toEqual([])
  })

  describe('When User type is included', () => {
    it('should do nothing if User type is included', async () => {
      const usersExcludedFetchQuery = createFetchQuery({
        ...DEFAULT_CONFIG,
        fetch: {
          ...DEFAULT_CONFIG.fetch,
          exclude: [],
        },
      })
      const changeValidator = usersValidator(client, DEFAULT_CONFIG, usersExcludedFetchQuery)
      const changeErrors = await changeValidator([toChange({ after: ruleInstance })])
      expect(changeErrors).toHaveLength(0)
    })
  })
})
