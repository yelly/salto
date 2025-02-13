/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { X2jOptions, XMLBuilder, XmlBuilderOptions, XMLParser } from 'fast-xml-parser'
import { strings, values } from '@salto-io/lowerdash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import {
  Change,
  ElemID,
  InstanceElement,
  SaltoElementError,
  getChangeData,
  isAdditionChange,
} from '@salto-io/adapter-api'
import { ADDITIONAL_DEPENDENCIES, FILE, FOLDER, SCRIPT_ID } from '../constants'
import {
  CustomizationInfo,
  CustomTypeInfo,
  DeployableChange,
  FileCustomizationInfo,
  FolderCustomizationInfo,
  SDFObjectChangeType,
  TemplateCustomTypeInfo,
} from './types'
import { NetsuiteTypesQueryParams } from '../config/types'
import { REQUIRED_FEATURE_SUFFIX } from '../config/constants'
import { ConfigRecord } from './suiteapp_client/types'
import { isFileCabinetInstance } from '../types'
import { getServiceIdsToElemIds } from '../service_id_info'
import { ATTRIBUTE_PREFIX } from './constants'
import { SoapDeployResult } from './suiteapp_client/soap_client/types'

const log = logger(module)
const { matchAll } = strings
const { isDefined } = values

export const isRequiredFeature = (featureName: string): boolean =>
  featureName.toLowerCase().endsWith(REQUIRED_FEATURE_SUFFIX)

export const removeRequiredFeatureSuffix = (featureName: string): string =>
  featureName.slice(0, featureName.length - REQUIRED_FEATURE_SUFFIX.length)

export const toError = (e: unknown): Error => {
  if (e instanceof Error) {
    return e
  }
  if (typeof e === 'string') {
    return new Error(e)
  }
  return new Error(safeJsonStringify(e))
}

export const isCustomTypeInfo = (customizationInfo: CustomizationInfo): customizationInfo is CustomTypeInfo =>
  'scriptId' in customizationInfo

export const isTemplateCustomTypeInfo = (
  customizationInfo: CustomizationInfo,
): customizationInfo is TemplateCustomTypeInfo =>
  'fileExtension' in customizationInfo && isCustomTypeInfo(customizationInfo)

export const isFileCustomizationInfo = (
  customizationInfo: CustomizationInfo,
): customizationInfo is FileCustomizationInfo => customizationInfo.typeName === FILE

export const isFolderCustomizationInfo = (
  customizationInfo: CustomizationInfo,
): customizationInfo is FolderCustomizationInfo => customizationInfo.typeName === FOLDER

export const mergeTypeToInstances = (...typeToInstances: NetsuiteTypesQueryParams[]): NetsuiteTypesQueryParams =>
  _.mergeWith({}, ...typeToInstances, (objValue: string[] | undefined, srcValue: string[]) =>
    objValue ? [...objValue, ...srcValue] : srcValue,
  )

export const getGroupItemFromRegex = (str: string, regex: RegExp, item: string): string[] =>
  Array.from(matchAll(str, regex))
    .map(r => r.groups)
    .filter(isDefined)
    .map(groups => groups[item])

export const sliceMessagesByRegex = (
  messages: string[],
  lookFromRegex: RegExp,
  includeMatchedRegex = true,
): string[] => {
  // remove the global flag of the regex
  const fixedLookedFromRegex = RegExp(lookFromRegex, lookFromRegex.flags.replace('g', ''))
  const matchedMessages = messages.map(message => fixedLookedFromRegex.test(message))
  const lookFromIndex = includeMatchedRegex ? matchedMessages.indexOf(true) : matchedMessages.lastIndexOf(true)
  return lookFromIndex !== -1 ? messages.slice(lookFromIndex + (includeMatchedRegex ? 0 : 1)) : []
}

export const getConfigRecordsFieldValue = (configRecord: ConfigRecord | undefined, field: string): unknown =>
  configRecord?.data?.fields?.[field]

export const toElementError = ({
  elemID,
  message,
  detailedMessage,
}: {
  elemID: ElemID
  message: string
  detailedMessage: string
}): SaltoElementError => ({
  elemID,
  message,
  detailedMessage,
  severity: 'Error',
})

export const toDependencyError = (dependency: { elemId: ElemID; dependOn: ElemID[] }): SaltoElementError => {
  const dependencies = _.uniq(dependency.dependOn)
  const message = `Element cannot be deployed due to an error in its ${
    dependencies.length > 1 ? 'dependencies' : 'dependency'
  }: ${dependencies.map(id => id.getFullName()).join(', ')}`
  return {
    elemID: dependency.elemId,
    message,
    detailedMessage: message,
    severity: 'Error',
  }
}

export const getDeployResultFromSuiteAppResult = <T extends Change>(
  changes: T[],
  results: SoapDeployResult[],
): {
  appliedChanges: T[]
  errors: SaltoElementError[]
  elemIdToInternalId: Record<string, string>
} => {
  const errors: SaltoElementError[] = []
  const appliedChanges: T[] = []
  const elemIdToInternalId: Record<string, string> = {}

  results.forEach((result, index) => {
    const change = changes[index]
    if (change === undefined) {
      log.warn('deploy result in index %d is beyond the changes list and will be ignored: %o', index, result)
      return
    }
    const { elemID } = getChangeData(change)
    if (result.isSuccess) {
      appliedChanges.push(change)
      elemIdToInternalId[elemID.getFullName()] = result.internalId
    } else {
      errors.push(toElementError({ elemID, message: result.errorMessage, detailedMessage: result.errorMessage }))
    }
  })

  return { appliedChanges, errors, elemIdToInternalId }
}

export const getChangeTypeAndAddedObjects = (
  change: DeployableChange & { action: 'add' | 'modify' },
): SDFObjectChangeType => {
  if (isAdditionChange(change)) {
    return { changeType: 'addition' }
  }
  if (isFileCabinetInstance(getChangeData(change))) {
    return { changeType: 'modification', addedObjects: new Set() }
  }
  const beforeInnerObjects = getServiceIdsToElemIds(change.data.before)
  const afterInnerObjects = getServiceIdsToElemIds(change.data.after)
  const addedInnerObjects = Object.keys(afterInnerObjects).filter(objName => beforeInnerObjects[objName] === undefined)
  log.debug(
    'the following inner objects of %s were added: %o',
    getChangeData(change).elemID.getFullName(),
    addedInnerObjects,
  )
  return { changeType: 'modification', addedObjects: new Set(addedInnerObjects) }
}

export const addAdditionalDependency = (instance: InstanceElement, scriptId: string): void => {
  if (instance.value[ADDITIONAL_DEPENDENCIES] === undefined) {
    instance.value[ADDITIONAL_DEPENDENCIES] = []
  }
  instance.value[ADDITIONAL_DEPENDENCIES].push(`[${SCRIPT_ID}=${scriptId}]`)
}

export const XML_PARSER_DEFAULT_OPTIONS: X2jOptions = {
  attributeNamePrefix: ATTRIBUTE_PREFIX,
  ignoreAttributes: false,
  processEntities: false,
}

export const XML_BUILDER_DEFAULT_OPTIONS: XmlBuilderOptions = {
  attributeNamePrefix: ATTRIBUTE_PREFIX,
  ignoreAttributes: false,
  processEntities: false,
  format: true,
  suppressBooleanAttributes: false,
}

export const xmlParser = new XMLParser(XML_PARSER_DEFAULT_OPTIONS)
export const xmlBuilder = new XMLBuilder(XML_BUILDER_DEFAULT_OPTIONS)
