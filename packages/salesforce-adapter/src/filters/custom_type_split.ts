/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { Element, isObjectType, ObjectType } from '@salto-io/adapter-api'
import { pathNaclCase } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { isCustom, isCustomObject, apiName } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import { getObjectDirectoryPath } from './custom_objects_to_object_type'
import { OBJECT_FIELDS_PATH } from '../constants'
import { isCustomMetadataRecordType } from './utils'

const { awu } = collections.asynciterable

export const annotationsFileName = (objectName: string): string => `${pathNaclCase(objectName)}Annotations`
export const standardFieldsFileName = (objectName: string): string => `${pathNaclCase(objectName)}StandardFields`
export const customFieldsFileName = (objectName: string): string => `${pathNaclCase(objectName)}CustomFields`

const perFieldFileName = (fieldName: string): string => pathNaclCase(fieldName)

const splitFields = async (customObject: ObjectType, splitAllFields: string[]): Promise<ObjectType[]> => {
  const pathPrefix = await getObjectDirectoryPath(customObject)

  if (splitAllFields.includes(await apiName(customObject))) {
    return Object.entries(customObject.fields).map(
      ([fieldName, field]) =>
        new ObjectType({
          elemID: customObject.elemID,
          fields: { [fieldName]: field },
          metaType: customObject.metaType,
          path: [...pathPrefix, OBJECT_FIELDS_PATH, perFieldFileName(fieldName)],
        }),
    )
  }

  const standardFieldsObject = new ObjectType({
    elemID: customObject.elemID,
    fields: _.pickBy(customObject.fields, f => !isCustom(f.elemID.getFullName())),
    metaType: customObject.metaType,
    path: [...pathPrefix, standardFieldsFileName(customObject.elemID.name)],
  })

  const customFieldsObject = new ObjectType({
    elemID: customObject.elemID,
    fields: _.pickBy(customObject.fields, f => isCustom(f.elemID.getFullName())),
    metaType: customObject.metaType,
    path: [...pathPrefix, customFieldsFileName(customObject.elemID.name)],
  })
  return [customFieldsObject, standardFieldsObject]
}

const customObjectToSplitElements = async (
  customObject: ObjectType,
  splitAllFields: string[],
): Promise<ObjectType[]> => {
  const pathPrefix = await getObjectDirectoryPath(customObject)

  const annotationsObject = new ObjectType({
    elemID: customObject.elemID,
    annotationRefsOrTypes: customObject.annotationRefTypes,
    annotations: customObject.annotations,
    metaType: customObject.metaType,
    path: [...pathPrefix, annotationsFileName(customObject.elemID.name)],
  })

  const fieldObjects = await splitFields(customObject, splitAllFields)
  return _.concat(fieldObjects, annotationsObject)
}

const filterCreator: FilterCreator = ({ config }) => ({
  name: 'customTypeSplit',
  onFetch: async (elements: Element[]) => {
    const customObjects = await awu(elements)
      .filter(isObjectType)
      .filter(async e => (await isCustomObject(e)) || isCustomMetadataRecordType(e))
      .toArray()
    const newSplitCustomObjects = await awu(customObjects)
      .flatMap(customObject => customObjectToSplitElements(customObject, config.separateFieldToFiles ?? []))
      .toArray()
    _.pullAllWith(
      elements,
      customObjects,
      // No need to check whether the object is a CustomObject since all of the elements in
      // the second params are custom objects.
      (elementA: Element, elementB: Element): boolean =>
        isObjectType(elementA) && isObjectType(elementB) && elementA.isEqual(elementB),
    )
    const isNotEmptyObject = (customObject: ObjectType): boolean =>
      !(_.isEmpty(customObject.annotations) && _.isEmpty(customObject.fields))
    elements.push(...newSplitCustomObjects.filter(isNotEmptyObject))
  },
})

export default filterCreator
