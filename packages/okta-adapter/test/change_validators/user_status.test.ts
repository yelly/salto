/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { toChange, ObjectType, ElemID, InstanceElement } from '@salto-io/adapter-api'
import { OKTA, USER_TYPE_NAME } from '../../src/constants'
import { userStatusValidator } from '../../src/change_validators/user_status'

describe('userStatusValidator', () => {
  const userType = new ObjectType({ elemID: new ElemID(OKTA, USER_TYPE_NAME) })

  describe('addition changes', () => {
    it.each(['ACTIVE', 'SUSPENDED', 'LOCKED_OUT', 'DEPROVISIONED', 'RECOVERY', 'PASSWORD_EXPIRED'])(
      'should return an error when user is created with %s status',
      async status => {
        const user = new InstanceElement('user', userType, { status, profile: { login: 'a@a' } })
        const changeErrors = await userStatusValidator([toChange({ after: user })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors).toEqual([
          {
            elemID: user.elemID,
            severity: 'Error',
            message: 'User can only be created with STAGED or PROVISIONED status',
            detailedMessage: 'To deploy this change, please update the status to STAGED or PROVISIONED.',
          },
        ])
      },
    )
    it.each(['STAGED', 'PROVISIONED'])(
      'should not return an error when user is created with %s status',
      async status => {
        const user = new InstanceElement('user', userType, { status, profile: { login: 'a@a' } })
        const changeErrors = await userStatusValidator([toChange({ after: user })])
        expect(changeErrors).toHaveLength(0)
      },
    )
  })

  describe('modification changes', () => {
    it.each(['STAGED', 'PROVISIONED', 'RECOVERY', 'PASSWORD_EXPIRED'])(
      'should return error when user status is modified from status %s to ACTIVE status',
      async status => {
        const userBefore = new InstanceElement('user', userType, { status, profile: { login: 'a@a' } })
        const userAfter = new InstanceElement('user', userType, { status: 'ACTIVE', profile: { login: 'a@a' } })
        const changeErrors = await userStatusValidator([toChange({ before: userBefore, after: userAfter })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors).toEqual([
          {
            elemID: userBefore.elemID,
            severity: 'Error',
            message: 'User activation is not supported',
            detailedMessage:
              'Activating a user requires either user action or setting a password, which are not supported by Salto. Therefore, users cannot be deployed with an ACTIVE status.',
          },
        ])
      },
    )
    it.each(['ACTIVE', 'SUSPENDED', 'LOCKED_OUT'])(
      'should not return error when user status is modified from status %s to ACTIVE status',
      async status => {
        const userBefore = new InstanceElement('user', userType, { status, profile: { login: 'a@a' } })
        const userAfter = new InstanceElement('user', userType, { status: 'ACTIVE', profile: { login: 'a@a' } })
        const changeErrors = await userStatusValidator([toChange({ before: userBefore, after: userAfter })])
        expect(changeErrors).toHaveLength(0)
      },
    )
    it.each(['STAGED', 'RECOVERY', 'PASSWORD_EXPIRED', 'SUSPENDED', 'LOCKED_OUT'])(
      'should return error when user status is modified from DEPROVISIONED status to %s status',
      async status => {
        const userBefore = new InstanceElement('user', userType, { status: 'DEPROVISIONED', profile: { login: 'a@a' } })
        const userAfter = new InstanceElement('user', userType, { status, profile: { login: 'a@a' } })
        const changeErrors = await userStatusValidator([toChange({ before: userBefore, after: userAfter })])
        expect(changeErrors).toHaveLength(1)
        expect(changeErrors).toEqual([
          {
            elemID: userBefore.elemID,
            severity: 'Error',
            message: 'DEPROVISIONED status can only be changed to PROVISIONED',
            detailedMessage:
              'A user with DEPROVISIONED status can only be changed to PROVISIONED status by reactivating the user.',
          },
        ])
      },
    )
    it.each(['PROVISIONED', 'DEPROVISIONED'])(
      'should not return error when user status is modified from DEPROVISIONED status to %s status',
      async status => {
        const userBefore = new InstanceElement('user', userType, { status: 'DEPROVISIONED', profile: { login: 'a@a' } })
        const userAfter = new InstanceElement('user', userType, { status, profile: { login: 'a@a' } })
        const changeErrors = await userStatusValidator([toChange({ before: userBefore, after: userAfter })])
        expect(changeErrors).toHaveLength(0)
      },
    )
  })
})
