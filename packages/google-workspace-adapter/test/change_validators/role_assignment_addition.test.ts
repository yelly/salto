/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { elementSource } from '@salto-io/workspace'
import { ADAPTER_NAME, GROUP_TYPE_NAME, ROLE_ASSIGNMENT_TYPE_NAME } from '../../src/constants'
import { roleAssignmentAdditionValidator } from '../../src/change_validators'

const additionError = (role: InstanceElement): ChangeError => ({
  elemID: role.elemID,
  severity: 'Error',
  message: 'Can not create role assignment for non security groups',
  detailedMessage: 'Can not create role assignment for non security groups',
})

describe('roleAssignmentAdditionValidator', () => {
  const groupType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, GROUP_TYPE_NAME) })
  const roleAssignmentType = new ObjectType({ elemID: new ElemID(ADAPTER_NAME, ROLE_ASSIGNMENT_TYPE_NAME) })
  const securityGroup = new InstanceElement('testGroup1', groupType, {
    labels: {
      'cloudidentity_googleapis_com_groups_security@vvdv': '',
      'cloudidentity_googleapis_com_groups_discussion_forum@vvdvu': '',
    },
  })
  const nonSecurityGroup = new InstanceElement('testGroup2', groupType, {
    labels: {
      'cloudidentity_googleapis_com_groups_discussion_forum@vvdvu': '',
    },
  })
  const roleAssignment1 = new InstanceElement('testRoleAssignment1', roleAssignmentType, {
    assignedTo: new ReferenceExpression(nonSecurityGroup.elemID, nonSecurityGroup),
  })
  const roleAssignment2 = new InstanceElement('testRoleAssignment2', roleAssignmentType, {
    assignedTo: new ReferenceExpression(securityGroup.elemID, securityGroup),
  })
  it('should return a Error if adding a role assignment to a non security group', async () => {
    const errors = await roleAssignmentAdditionValidator(
      [toChange({ after: roleAssignment1 })],
      elementSource.createInMemoryElementSource([roleAssignment1, nonSecurityGroup]),
    )
    expect(errors).toEqual([additionError(roleAssignment1)])
  })
  it('should not return a Error if adding a role assignment to a security group', async () => {
    const errors = await roleAssignmentAdditionValidator(
      [toChange({ after: roleAssignment2 })],
      elementSource.createInMemoryElementSource([roleAssignment2, securityGroup]),
    )
    expect(errors).toEqual([])
  })
})
