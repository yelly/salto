/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  InstanceElement,
  toChange,
  UnresolvedReference,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { brokenReferenceValidator } from '../../src/change_validators/broken_references'
import { AUTOMATION_TYPE, JIRA, PROJECT_TYPE } from '../../src/constants'

describe('automationProjectUnresolvedReferenceValidator', () => {
  let automationType: ObjectType
  let projectType: ObjectType
  let automationInstance: InstanceElement
  let projectInstance: InstanceElement
  let unresolvedElemId: ElemID

  beforeEach(() => {
    automationType = new ObjectType({ elemID: new ElemID(JIRA, AUTOMATION_TYPE) })
    projectType = new ObjectType({ elemID: new ElemID(JIRA, PROJECT_TYPE) })
    projectInstance = new InstanceElement('ProjectInstance', projectType)
    unresolvedElemId = new ElemID(JIRA, 'unresolvedProject')
    automationInstance = new InstanceElement('AutomationInstance', automationType, {
      projects: [
        {
          projectId: new ReferenceExpression(projectType.elemID, { projectId: projectInstance }),
        },
        {
          projectId: new ReferenceExpression(projectType.elemID, new UnresolvedReference(unresolvedElemId)),
        },
      ],
    })
  })

  it('should return a warning when project reference is unresolved', async () => {
    expect(await brokenReferenceValidator([toChange({ after: automationInstance })])).toEqual([
      {
        elemID: automationInstance.elemID,
        severity: 'Warning',
        message: 'Automation won’t be attached to some projects',
        detailedMessage:
          'The automation is attached to some projects which do not exist in the target environment: unresolvedProject. If you continue, the automation will be deployed without them. Alternatively, you can go back and include these projects in your deployment.',
      },
    ])
  })
  it('should not return a warning when there is not a project reference that is unresolved', async () => {
    automationInstance.value.projects = [
      {
        projectId: new ReferenceExpression(projectType.elemID, { projectId: projectInstance }),
      },
    ]

    expect(await brokenReferenceValidator([toChange({ after: automationInstance })])).toEqual([])
  })
  it('should return an error when all the projects references are unresolved', async () => {
    automationInstance.value.projects = [
      {
        projectId: new ReferenceExpression(projectType.elemID, new UnresolvedReference(unresolvedElemId)),
      },
    ]

    expect(await brokenReferenceValidator([toChange({ after: automationInstance })])).toEqual([
      {
        elemID: automationInstance.elemID,
        severity: 'Error',
        message: 'Automation isn’t attached to any existing project',
        detailedMessage:
          'All projects attached to this automation do not exist in the target environment: unresolvedProject. The automation can’t be deployed. To solve this, go back and include at least one attached project in your deployment.',
      },
    ])
  })
})
