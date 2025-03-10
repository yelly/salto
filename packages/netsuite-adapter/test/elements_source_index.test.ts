/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { entitycustomfieldType } from '../src/autogen/types/standard_types/entitycustomfield'
import { CUSTOM_RECORD_TYPE, INTERNAL_ID, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../src/constants'
import { createElementsSourceIndex } from '../src/elements_source_index/elements_source_index'
import { getTypesToInternalId } from '../src/data_elements/types'

describe('createElementsSourceIndex', () => {
  const getAllMock = jest.fn()
  const getMock = jest.fn()
  const elementsSource = {
    getAll: getAllMock,
    get: getMock,
  } as unknown as ReadOnlyElementsSource
  const entitycustomfield = entitycustomfieldType().type
  const { typeToInternalId, internalIdToTypes } = getTypesToInternalId([])

  beforeEach(() => {
    getAllMock.mockReset()
    getMock.mockReset()
    getAllMock.mockImplementation(buildElementsSourceFromElements([]).getAll)
  })
  it('should create the index only once and cache it', async () => {
    const elementsSourceIndex = createElementsSourceIndex({
      elementsSource,
      isPartial: true,
      typeToInternalId,
      internalIdToTypes,
    })
    const index = await elementsSourceIndex.getIndexes()
    const anotherIndex = await elementsSourceIndex.getIndexes()
    expect(index).toBe(anotherIndex)
    expect(getAllMock).toHaveBeenCalledTimes(1)
  })
  it('should create the right internal ids index', async () => {
    const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') })
    getMock.mockImplementation(buildElementsSourceFromElements([type]).get)
    getAllMock.mockImplementation(
      buildElementsSourceFromElements([
        new InstanceElement('name', type, { internalId: '4' }),
        type,
        new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord1'),
          annotations: {
            [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
            [SCRIPT_ID]: 'customrecord1',
            [INTERNAL_ID]: '2',
          },
        }),
      ]).getAll,
    )

    const elementsSourceIndex = createElementsSourceIndex({
      elementsSource,
      isPartial: true,
      typeToInternalId,
      internalIdToTypes,
    })
    const index = (await elementsSourceIndex.getIndexes()).internalIdsIndex
    expect(index).toEqual({
      'someType-4': new ElemID(NETSUITE, 'someType', 'instance', 'name'),
      'customrecordtype-2': new ElemID(NETSUITE, 'customrecord1'),
      '-123-2': new ElemID(NETSUITE, 'customrecord1'),
      '-125-2': new ElemID(NETSUITE, 'customrecord1'),
    })
  })
  it('should not create internal ids index for a deleted element', async () => {
    const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') })
    const toBeDeleted = new InstanceElement('name', type, { internalId: '4' })
    getMock.mockImplementation(buildElementsSourceFromElements([type]).get)
    getAllMock.mockImplementation(
      buildElementsSourceFromElements([
        toBeDeleted,
        type,
        new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord1'),
          annotations: {
            [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
            [SCRIPT_ID]: 'customrecord1',
            [INTERNAL_ID]: '2',
          },
        }),
      ]).getAll,
    )

    const elementsSourceIndex = createElementsSourceIndex({
      elementsSource,
      isPartial: true,
      typeToInternalId,
      internalIdToTypes,
      deletedElements: [toBeDeleted.elemID],
    })
    const index = (await elementsSourceIndex.getIndexes()).internalIdsIndex
    expect(index).toEqual({
      'customrecordtype-2': new ElemID(NETSUITE, 'customrecord1'),
      '-123-2': new ElemID(NETSUITE, 'customrecord1'),
      '-125-2': new ElemID(NETSUITE, 'customrecord1'),
    })
  })
  it('should not create internal ids index on full fetch', async () => {
    const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') })
    getMock.mockImplementation(buildElementsSourceFromElements([type]).get)
    getAllMock.mockImplementation(
      buildElementsSourceFromElements([
        new InstanceElement('name', type, { internalId: '4' }),
        type,
        new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord1'),
          annotations: {
            [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
            [SCRIPT_ID]: 'customrecord1',
            [INTERNAL_ID]: '2',
          },
        }),
      ]).getAll,
    )

    const elementsSourceIndex = createElementsSourceIndex({
      elementsSource,
      isPartial: false,
      typeToInternalId,
      internalIdToTypes,
    })
    const index = (await elementsSourceIndex.getIndexes()).internalIdsIndex
    expect(index).toEqual({})
  })

  it('should create the right custom fields index', async () => {
    const instance1 = new InstanceElement('name1', entitycustomfield, {
      appliestocontact: true,
      appliestocustomer: false,
      appliestoemployee: true,
    })
    const instance2 = new InstanceElement('name2', entitycustomfield, {
      appliestocontact: true,
      appliestocustomer: false,
      appliestoemployee: false,
    })
    getAllMock.mockImplementation(buildElementsSourceFromElements([instance1, instance2]).getAll)

    const elementsSourceIndex = createElementsSourceIndex({
      elementsSource,
      isPartial: true,
      typeToInternalId,
      internalIdToTypes,
    })
    const index = (await elementsSourceIndex.getIndexes()).customFieldsIndex
    expect(index.contact.map(e => e.elemID.getFullName())).toEqual(
      [instance1, instance2].map(e => e.elemID.getFullName()),
    )

    expect(index.employee.map(e => e.elemID.getFullName())).toEqual([instance1.elemID.getFullName()])
  })
  it('should not create custom fields index on full fetch', async () => {
    const instance1 = new InstanceElement('name1', entitycustomfield, {
      appliestocontact: true,
      appliestocustomer: false,
      appliestoemployee: true,
    })
    const instance2 = new InstanceElement('name2', entitycustomfield, {
      appliestocontact: true,
      appliestocustomer: false,
      appliestoemployee: false,
    })
    getAllMock.mockImplementation(buildElementsSourceFromElements([instance1, instance2]).getAll)

    const elementsSourceIndex = createElementsSourceIndex({
      elementsSource,
      isPartial: false,
      typeToInternalId,
      internalIdToTypes,
    })
    const index = (await elementsSourceIndex.getIndexes()).customFieldsIndex
    expect(index).toEqual({})
  })

  it('should create the right elemIdToChangeByIndex index', async () => {
    const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') })
    getAllMock.mockImplementation(
      buildElementsSourceFromElements([
        new InstanceElement('inst', type, {}, undefined, { [CORE_ANNOTATIONS.CHANGED_BY]: 'user name' }),
        new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord1'),
          annotations: {
            [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
            [CORE_ANNOTATIONS.CHANGED_BY]: 'user name2',
          },
        }),
      ]).getAll,
    )

    expect(
      (
        await createElementsSourceIndex({
          elementsSource,
          isPartial: true,
          typeToInternalId,
          internalIdToTypes,
        }).getIndexes()
      ).elemIdToChangeByIndex,
    ).toEqual({
      'netsuite.someType.instance.inst': 'user name',
      'netsuite.customrecord1': 'user name2',
    })
    expect(
      (
        await createElementsSourceIndex({
          elementsSource,
          isPartial: false,
          typeToInternalId,
          internalIdToTypes,
        }).getIndexes()
      ).elemIdToChangeByIndex,
    ).toEqual({
      'netsuite.someType.instance.inst': 'user name',
      'netsuite.customrecord1': 'user name2',
    })
  })
  it('should create the right elemIdToChangeAtIndex index', async () => {
    const type = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') })
    getAllMock.mockImplementation(
      buildElementsSourceFromElements([
        new InstanceElement('inst', type, {}, undefined, { [CORE_ANNOTATIONS.CHANGED_AT]: '03/23/2022' }),
        new ObjectType({
          elemID: new ElemID(NETSUITE, 'customrecord1'),
          annotations: {
            [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
            [CORE_ANNOTATIONS.CHANGED_AT]: '05/26/2022',
          },
        }),
      ]).getAll,
    )

    expect(
      (
        await createElementsSourceIndex({
          elementsSource,
          isPartial: true,
          typeToInternalId,
          internalIdToTypes,
        }).getIndexes()
      ).elemIdToChangeAtIndex,
    ).toEqual({
      'netsuite.someType.instance.inst': '03/23/2022',
      'netsuite.customrecord1': '05/26/2022',
    })
    expect(
      (
        await createElementsSourceIndex({
          elementsSource,
          isPartial: false,
          typeToInternalId,
          internalIdToTypes,
        }).getIndexes()
      ).elemIdToChangeAtIndex,
    ).toEqual({
      'netsuite.someType.instance.inst': '03/23/2022',
      'netsuite.customrecord1': '05/26/2022',
    })
  })
  it('should create the correct customRecordField index', async () => {
    const custRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      fields: {
        custom_field: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [SCRIPT_ID]: 'custom_field',
          },
        },
      },
      annotations: {
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    const custRecordField = custRecordType.fields.custom_field
    getAllMock.mockImplementation(buildElementsSourceFromElements([custRecordType]).getAll)
    expect(
      (
        await createElementsSourceIndex({
          elementsSource,
          isPartial: true,
          typeToInternalId,
          internalIdToTypes,
        }).getIndexes()
      ).customRecordFieldsServiceIdRecordsIndex,
    ).toEqual({
      custom_field: { elemID: custRecordField.elemID.createNestedID(SCRIPT_ID), serviceID: 'custom_field' },
    })
  })
  it('should create the correct customFieldsSelectRecordType index', async () => {
    const customFieldInstance = new InstanceElement('customentityfield123', entitycustomfield, {
      selectrecordtype: '-4',
    })
    const custRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      fields: {
        custom_field: {
          refType: BuiltinTypes.STRING,
          annotations: {
            selectrecordtype: new ReferenceExpression(customFieldInstance.elemID.createNestedID(SCRIPT_ID)),
          },
        },
      },
      annotations: {
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    getAllMock.mockImplementation(buildElementsSourceFromElements([custRecordType, customFieldInstance]).getAll)
    expect(
      (
        await createElementsSourceIndex({
          elementsSource,
          isPartial: true,
          typeToInternalId,
          internalIdToTypes,
        }).getIndexes()
      ).customFieldsSelectRecordTypeIndex,
    ).toEqual({
      [customFieldInstance.elemID.getFullName()]: '-4',
      [custRecordType.elemID.createNestedID('field', 'custom_field').getFullName()]: new ReferenceExpression(
        customFieldInstance.elemID.createNestedID(SCRIPT_ID),
      ),
    })
  })
})
