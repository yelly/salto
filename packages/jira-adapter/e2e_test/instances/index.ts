/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { v4 as uuidv4 } from 'uuid'
import {
  InstanceElement,
  Element,
  ElemID,
  CORE_ANNOTATIONS,
  ReferenceExpression,
  ModificationChange,
} from '@salto-io/adapter-api'
import { inspectValue, naclCase } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { JIRA, WEBHOOK_TYPE, STATUS_TYPE_NAME } from '../../src/constants'
import { createReference, findType } from '../utils'
import {
  createCascadeContextAndRelatedInstances,
  createCascadeFieldValues,
  createMultiSelectContextAndRelatedInstances,
  createMultiSelectFieldValues,
  createProjectScopeContextValues,
} from './field'
import { createFieldConfigurationSchemeValues } from './fieldConfigurationScheme'
import { createIssueTypeScreenSchemeValues } from './issueTypeScreenScheme'
import { createScreenValues } from './screen'
import { createWebhookValues } from './webhook'
import { createStatusValues } from './status'
import { createInstances as createDataCenterInstances, modifyDataCenterInstances } from './datacenter'
import { createInstances as createCloudInstances, modifyCloudInstances } from './cloud'
import { CUSTOM_FIELDS_SUFFIX } from '../../src/filters/fields/constants'

const log = logger(module)

export const createInstances = (fetchedElements: Element[], isDataCenter: boolean): InstanceElement[][] => {
  const randomString = `createdByOssE2e${String(Date.now()).substring(6)}`
  const uuid = uuidv4()

  const cascadeField = new InstanceElement(
    `${randomString}__cascadingselect__${CUSTOM_FIELDS_SUFFIX}`,
    findType('Field', fetchedElements),
    createCascadeFieldValues(randomString),
  )

  const projectScopedFieldContext = new InstanceElement(
    naclCase(`${randomString}__cascadingselect__${CUSTOM_FIELDS_SUFFIX}_${randomString}project`),
    findType('CustomFieldContext', fetchedElements),
    createProjectScopeContextValues(`${randomString}project`, fetchedElements),
    undefined,
    { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(cascadeField.elemID, cascadeField)] },
  )

  const { contextInstance, contextOptions, contextOrders } = createCascadeContextAndRelatedInstances({
    allElements: fetchedElements,
    fieldInstance: cascadeField,
    randomString,
  })

  const multiSelectField = new InstanceElement(
    `${randomString}__multiselect__${CUSTOM_FIELDS_SUFFIX}`,
    findType('Field', fetchedElements),
    createMultiSelectFieldValues(randomString),
  )

  const {
    contextInstance: multiSelectFieldContext,
    contextOptions: multiSelectContextOptions,
    contextOrders: multiSelectContextOrders,
  } = createMultiSelectContextAndRelatedInstances({
    allElements: fetchedElements,
    fieldInstance: multiSelectField,
    randomString,
  })

  const screen = new InstanceElement(
    randomString,
    findType('Screen', fetchedElements),
    createScreenValues(randomString, fetchedElements),
  )

  const screenScheme = new InstanceElement(randomString, findType('ScreenScheme', fetchedElements), {
    name: randomString,
    description: randomString,
    screens: {
      default: createReference(new ElemID(JIRA, 'Screen', 'instance', 'Default_Screen@s'), fetchedElements),
    },
  })

  const issueTypeScreenScheme = new InstanceElement(
    randomString,
    findType('IssueTypeScreenScheme', fetchedElements),
    createIssueTypeScreenSchemeValues(randomString, fetchedElements),
  )

  const fieldConfigurationScheme = new InstanceElement(
    randomString,
    findType('FieldConfigurationScheme', fetchedElements),
    createFieldConfigurationSchemeValues(randomString, fetchedElements),
  )

  const issueLinkType = new InstanceElement(randomString, findType('IssueLinkType', fetchedElements), {
    name: randomString,
    inward: randomString,
    outward: randomString,
  })

  const projectRole = new InstanceElement(randomString, findType('ProjectRole', fetchedElements), {
    name: randomString,
    description: randomString,
  })

  const webhook = new InstanceElement(
    randomString,
    findType(WEBHOOK_TYPE, fetchedElements),
    createWebhookValues(randomString, fetchedElements),
  )

  // const group = new InstanceElement(
  //   randomString,
  //   findType('Group', fetchedElements),
  //   {
  //     name: randomString,
  //   },
  // )

  const status = new InstanceElement(
    randomString.toLowerCase(),
    findType(STATUS_TYPE_NAME, fetchedElements),
    createStatusValues(randomString.toLowerCase(), fetchedElements),
  )

  const instances = [
    ...(isDataCenter
      ? createDataCenterInstances(randomString, fetchedElements)
      : createCloudInstances(randomString, uuid, fetchedElements)),
    [cascadeField],
    [contextInstance, ...contextOptions],
    [projectScopedFieldContext],
    contextOrders,
    [multiSelectField],
    [multiSelectFieldContext, ...multiSelectContextOptions],
    multiSelectContextOrders,
    [screen],
    [screenScheme],
    [issueTypeScreenScheme],
    [fieldConfigurationScheme],
    [issueLinkType],
    [projectRole],
    [webhook],
    // [group],
    [status],
  ]
  instances.forEach(instGroup =>
    instGroup.forEach(instance =>
      log.debug(`E2E created instance ${instance.elemID.getFullName()} with values ${inspectValue(instance.value)}`),
    ),
  )
  return instances
}

export const createModifyInstances = (
  fetchedElements: Element[],
  isDataCenter: boolean,
): ModificationChange<InstanceElement>[][] => [
  ...(isDataCenter ? modifyDataCenterInstances(fetchedElements) : modifyCloudInstances(fetchedElements)),
]
