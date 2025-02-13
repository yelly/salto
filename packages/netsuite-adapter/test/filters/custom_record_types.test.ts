/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  ElemID,
  isObjectType,
  ObjectType,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { LocalFilterOpts } from '../../src/filter'
import { CUSTOM_RECORD_TYPE, METADATA_TYPE, NETSUITE, SCRIPT_ID } from '../../src/constants'
import filterCreator from '../../src/filters/custom_record_types'
import { LazyElementsSourceIndexes } from '../../src/elements_source_index/types'
import { emptyQueryParams } from '../../src/config/config_creator'
import { getTypesToInternalId } from '../../src/data_elements/types'

const { awu } = collections.asynciterable

describe('custom record types filter', () => {
  let customRecordType: ObjectType
  let customRecordFieldRefType: ObjectType
  let lockedCustomRecordFieldRefType: ObjectType
  let dataType: ObjectType
  let anotherDataType: ObjectType

  const { typeToInternalId, internalIdToTypes } = getTypesToInternalId([{ name: 'data_type', typeId: '1234' }])
  const filterOpts = {
    config: { fetch: { include: { types: [{ name: '.*' }], fileCabinet: ['.*'] }, exclude: emptyQueryParams() } },
    isPartial: false,
    elementsSourceIndex: {
      getIndexes: () => {
        throw new Error('should not call getIndexes')
      },
    },
    elementsSource: {
      list: () => {
        throw new Error('should not call elementsSource.list')
      },
    },
    typeToInternalId,
    internalIdToTypes,
  } as unknown as LocalFilterOpts

  beforeEach(() => {
    customRecordType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord1'),
      annotations: {
        scriptid: 'customrecord1',
        customrecordcustomfields: {
          customrecordcustomfield: [
            {
              scriptid: 'custrecord_newfield',
              fieldtype: 'TEXT',
            },
            {
              scriptid: 'custrecord_ref',
              fieldtype: 'SELECT',
              selectrecordtype: `[${SCRIPT_ID}=customrecord2]`,
            },
            {
              scriptid: 'custrecord_ref_locked',
              fieldtype: 'SELECT',
              selectrecordtype: `[${SCRIPT_ID}=customrecord_locked]`,
            },
            {
              scriptid: 'custrecord_account',
              fieldtype: 'SELECT',
              selectrecordtype: '-112',
            },
            {
              scriptid: 'custrecord_data_type',
              fieldtype: 'SELECT',
              selectrecordtype: '1234',
            },
          ],
        },
        instances: [1, 2, 3],
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    customRecordFieldRefType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord2'),
      annotations: {
        scriptid: 'customrecord2',
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      },
    })
    lockedCustomRecordFieldRefType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'customrecord_locked'),
      annotations: {
        scriptid: 'customrecord_locked',
        [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
        [CORE_ANNOTATIONS.HIDDEN]: true,
      },
    })
    dataType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'account'),
    })
    anotherDataType = new ObjectType({
      elemID: new ElemID(NETSUITE, 'data_type'),
    })
  })
  it('should add fields to type', async () => {
    await filterCreator(filterOpts).onFetch?.([
      customRecordType,
      customRecordFieldRefType,
      lockedCustomRecordFieldRefType,
      dataType,
      anotherDataType,
    ])
    expect(Object.keys(customRecordType.fields)).toEqual([
      'custom_custrecord_newfield',
      'custom_custrecord_ref',
      'custom_custrecord_ref_locked',
      'custom_custrecord_account',
      'custom_custrecord_data_type',
    ])
    expect(customRecordType.fields.custom_custrecord_newfield.refType.elemID.name).toEqual(
      BuiltinTypes.STRING.elemID.name,
    )
    expect(customRecordType.fields.custom_custrecord_newfield.annotations).toEqual({
      scriptid: 'custrecord_newfield',
      fieldtype: 'TEXT',
      index: 0,
    })
    expect(customRecordType.fields.custom_custrecord_ref.refType.elemID.name).toEqual('customrecord2')
    expect(customRecordType.fields.custom_custrecord_ref.annotations).toEqual({
      scriptid: 'custrecord_ref',
      fieldtype: 'SELECT',
      selectrecordtype: `[${SCRIPT_ID}=customrecord2]`,
      index: 1,
    })
    expect(customRecordType.fields.custom_custrecord_ref_locked.refType.elemID.name).toEqual(
      BuiltinTypes.UNKNOWN.elemID.name,
    )
    expect(customRecordType.fields.custom_custrecord_ref_locked.annotations).toEqual({
      scriptid: 'custrecord_ref_locked',
      fieldtype: 'SELECT',
      selectrecordtype: `[${SCRIPT_ID}=customrecord_locked]`,
      index: 2,
    })
    expect(customRecordType.fields.custom_custrecord_account.refType.elemID.name).toEqual('account')
    expect(customRecordType.fields.custom_custrecord_account.annotations).toEqual({
      scriptid: 'custrecord_account',
      fieldtype: 'SELECT',
      selectrecordtype: '-112',
      index: 3,
    })
    expect(customRecordType.fields.custom_custrecord_data_type.refType.elemID.name).toEqual('data_type')
    expect(customRecordType.fields.custom_custrecord_data_type.annotations).toEqual({
      scriptid: 'custrecord_data_type',
      fieldtype: 'SELECT',
      selectrecordtype: '1234',
      index: 4,
    })
  })
  it('should add fields correctly on partial fetch', async () => {
    await filterCreator({
      ...filterOpts,
      isPartial: true,
      elementsSourceIndex: {
        getIndexes: () =>
          Promise.resolve({
            serviceIdRecordsIndex: {
              customrecord2: {
                elemID: new ElemID(NETSUITE, 'customrecord2', 'attr', 'scriptid'),
                serviceID: 'customrecord2',
              },
            },
          }),
      } as unknown as LazyElementsSourceIndexes,
      elementsSource: {
        list: async () => awu([dataType.elemID]),
      } as unknown as ReadOnlyElementsSource,
    }).onFetch?.([customRecordType])
    const field1refType = await customRecordType.fields.custom_custrecord_ref.getType()
    expect(isObjectType(field1refType) && field1refType.isEqual(customRecordFieldRefType)).toBeTruthy()
    const field2refType = await customRecordType.fields.custom_custrecord_account.getType()
    expect(field2refType.elemID.isEqual(dataType.elemID)).toBeTruthy()
  })
  it('should remove custom fields annotation', async () => {
    await filterCreator(filterOpts).onFetch?.([customRecordType])
    expect(customRecordType.annotations.customrecordcustomfields).toBeUndefined()
  })
  it('should not remove instances annotation if there are no custom record instances', async () => {
    await filterCreator(filterOpts).onFetch?.([customRecordType])
    expect(customRecordType.annotations.instances).toEqual([1, 2, 3])
  })
  it('should remove instances annotation if custom records fetch is enabled in the adapter config', async () => {
    await filterCreator({
      ...filterOpts,
      config: {
        fetch: {
          include: {
            types: [],
            fileCabinet: [],
            customRecords: [{ name: customRecordType.elemID.name }],
          },
          exclude: {
            types: [],
            fileCabinet: [],
            customRecords: [],
          },
        },
      },
    }).onFetch?.([customRecordType])
    expect(customRecordType.annotations.instances).toBeUndefined()
  })
})
