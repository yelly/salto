/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { isObjectType, Element } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
import { generateType } from './type_elements'
import { DATA_FIELD_ENTIRE_OBJECT } from '../../definitions'
import { getTransformationConfigByType, TypeDuckTypeConfig, TypeDuckTypeDefaultsConfig } from '../../config_deprecated'
import { toNestedTypeName } from '../../fetch/element'

/**
 * Add empty object types for all types that can have instances in the workspace,
 *  even if no instances will be created for them in the current fetch.
 * This is needed because if instances are added / cloned from another environment,
 *  they need to have a type in order to be deployed.
 *
 * Note: modifies the elements array in-place.
 */
export const addRemainingTypes = ({
  elements,
  typesConfig,
  adapterName,
  supportedTypes,
  typeDefaultConfig,
}: {
  elements: Element[]
  typesConfig: Record<string, TypeDuckTypeConfig>
  adapterName: string
  supportedTypes: Record<string, string[]>
  typeDefaultConfig: TypeDuckTypeDefaultsConfig
}): void => {
  const sourceTypeNameToTypeName = _(typesConfig)
    .pickBy(typeConfig => typeConfig.transformation?.sourceTypeName !== undefined)
    .entries()
    .map(([typeName, typeConfig]) => [typeConfig?.transformation?.sourceTypeName, typeName])
    .fromPairs()
    .value()
  const typeNames = _(typesConfig)
    .entries()
    .flatMap(([typeName, typeConfig]) => {
      const { dataField, standaloneFields } = typeConfig.transformation ?? {}
      const nestedFields = [
        ...(dataField && dataField !== DATA_FIELD_ENTIRE_OBJECT ? [dataField] : []),
        ...(standaloneFields ?? []).map(field => field.fieldName),
      ].map(fieldName => toNestedTypeName(typeName, fieldName))
      return [typeName, ...nestedFields]
    })
    .map(typeName => sourceTypeNameToTypeName[typeName] ?? typeName)
    .uniq()
    .value()
  const existingTypeNames = new Set(elements.filter(isObjectType).map(e => e.elemID.typeName))
  const typesToAdd = typeNames
    .filter(typeName => !existingTypeNames.has(naclCase(typeName)))
    .map(
      typeName =>
        generateType({
          adapterName,
          entries: [{}],
          name: typeName,
          hasDynamicFields: false,
          transformationConfigByType: getTransformationConfigByType(typesConfig),
          transformationDefaultConfig: typeDefaultConfig.transformation,
          isSubType: !Object.values(supportedTypes).flat().includes(sourceTypeNameToTypeName[typeName]),
        }).type,
    )
  elements.push(...typesToAdd)
}
