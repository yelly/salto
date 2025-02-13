/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'
import {
  InstanceElement,
  isMapType,
  getDeepInnerType,
  ObjectType,
  ElemID,
  MapType,
  toChange,
  getChangeData,
  Change,
  ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../src/constants'
import fieldPermissionsEnumFilter, {
  enumFieldPermissions,
  profileFieldLevelSecurity,
} from '../../src/filters/field_permissions_enum'
import { generateProfileType, defaultFilterContext, buildFilterContext } from '../utils'
import { API_NAME, CUSTOM_OBJECT, METADATA_TYPE, PERMISSION_SET_METADATA_TYPE, SALESFORCE } from '../../src/constants'
import { FilterWith } from './mocks'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

const { awu } = collections.asynciterable

describe('FieldPermissionsEnum filter', () => {
  let filter: FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
  const profileObj = generateProfileType(true)
  const permissionSetObject = new ObjectType({
    elemID: new ElemID(SALESFORCE, PERMISSION_SET_METADATA_TYPE),
    fields: {
      fieldPermissions: {
        refType: new MapType(new MapType(profileFieldLevelSecurity)),
      },
    },
    annotations: {
      [METADATA_TYPE]: PERMISSION_SET_METADATA_TYPE,
    },
  })
  const permissionSetObjectBeforeConvert = new ObjectType({
    elemID: new ElemID(SALESFORCE, PERMISSION_SET_METADATA_TYPE),
    fields: {
      fieldPermissions: { refType: new ListType(profileFieldLevelSecurity) },
    },
    annotations: {
      [METADATA_TYPE]: PERMISSION_SET_METADATA_TYPE,
    },
  })
  const fieldPermissionObjectValue = {
    ObjA: {
      FieldA: {
        field: 'ObjA.FieldA',
        editable: true,
        readable: true,
      },
      FieldB: {
        field: 'ObjA.FieldB',
        editable: false,
        readable: true,
      },
      FieldC: {
        field: 'ObjA.FieldC',
        editable: false,
        readable: false,
      },
    },
    ObjB: {
      FieldA: {
        field: 'ObjB.FieldA',
        editable: false,
        readable: false,
      },
      FieldB: {
        field: 'ObjB.FieldB',
        editable: false,
        readable: true,
      },
      FieldC: {
        field: 'ObjB.FieldC',
        editable: true,
        readable: true,
      },
    },
  }
  const fieldPermissionObjectValueAsList = [
    {
      field: 'ObjA.FieldA',
      editable: true,
      readable: true,
    },
    {
      field: 'ObjA.FieldB',
      editable: false,
      readable: true,
    },
  ]
  const fieldPermissionEnumValue = {
    ObjA: {
      FieldA: 'ReadWrite',
      FieldB: 'ReadOnly',
      FieldC: 'NoAccess',
    },
    ObjB: {
      FieldA: 'NoAccess',
      FieldB: 'ReadOnly',
      FieldC: 'ReadWrite',
    },
  }
  const profileInstance = new InstanceElement('profileInst', profileObj, {
    fieldPermissions: fieldPermissionObjectValue,
  })
  const permissionSetInstance = new InstanceElement('permissionSetInst', permissionSetObject, {
    fieldPermissions: fieldPermissionObjectValue,
  })
  const permissionSetInstanceBeforeConvert = new InstanceElement(
    'permissionSetInstanceBeforeConvert',
    permissionSetObjectBeforeConvert,
    {
      fieldPermissions: fieldPermissionObjectValueAsList,
    },
  )

  const objA = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'ObjA', 'type'),
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: 'ObjA',
    },
  })

  const objB = new ObjectType({
    elemID: new ElemID(SALESFORCE, 'ObjB', 'type'),
    annotations: {
      [METADATA_TYPE]: CUSTOM_OBJECT,
      [API_NAME]: 'ObjB',
    },
  })

  describe('onFetch', () => {
    let elements: (InstanceElement | ObjectType)[]
    let profileInstanceClone: InstanceElement
    let permissionSetInstanceClone: InstanceElement
    let permissionSetObjectClone: ObjectType
    let profileObjectClone: ObjectType
    let permissionSetObjectBeforeConvertClone: ObjectType
    let permissionSetInstanceBeforeConvertClone: InstanceElement

    beforeAll(async () => {
      profileInstanceClone = profileInstance.clone()
      permissionSetInstanceClone = permissionSetInstance.clone()
      permissionSetObjectClone = permissionSetObject.clone()
      profileObjectClone = profileObj.clone()
      permissionSetObjectBeforeConvertClone = permissionSetObjectBeforeConvert.clone()
      permissionSetInstanceBeforeConvertClone = permissionSetInstanceBeforeConvert.clone()
      elements = [
        profileObjectClone,
        permissionSetObjectClone,
        profileInstanceClone,
        permissionSetInstanceClone,
        permissionSetObjectBeforeConvertClone,
        permissionSetInstanceBeforeConvertClone,
        objA,
        objB,
      ]
      filter = fieldPermissionsEnumFilter({
        config: defaultFilterContext,
      }) as FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
      await filter.onFetch(elements)
    })

    it('should convert Profile Object fieldPermissions type to fieldPermissionEnum', async () => {
      const fieldPermissionsFieldType = await profileObjectClone.fields.fieldPermissions.getType()
      expect(isMapType(fieldPermissionsFieldType)).toBeTruthy()
      const deepInnerFieldPermissionType = await getDeepInnerType(fieldPermissionsFieldType)
      expect(deepInnerFieldPermissionType.elemID.isEqual(enumFieldPermissions.elemID)).toBeTruthy()
    })

    it('should convert PermissionSet Object fieldPermissions type to fieldPermissionEnum', async () => {
      const fieldPermissionsFieldType = await permissionSetObjectClone.fields.fieldPermissions.getType()
      expect(isMapType(fieldPermissionsFieldType)).toBeTruthy()
      const deepInnerFieldPermissionType = await getDeepInnerType(fieldPermissionsFieldType)
      expect(deepInnerFieldPermissionType.elemID.isEqual(enumFieldPermissions.elemID)).toBeTruthy()
    })

    it("should convert Profile and PermissionSet instances' fieldPermissions values to right enums", async () => {
      ;[profileInstanceClone, permissionSetInstanceClone].forEach(instance => {
        expect(instance.value).toEqual({
          fieldPermissions: fieldPermissionEnumValue,
        })
      })
    })

    it('should not covert Profile and PermissionSet type and instances if field did not convert to map', async () => {
      expect(permissionSetInstanceBeforeConvertClone.value.fieldPermissions).toEqual(fieldPermissionObjectValueAsList)
      expect(isMapType(await permissionSetObjectBeforeConvertClone.fields.fieldPermissions.getType())).toBeFalsy()
    })

    describe('with fieldPermissions that are not part of the fetch', () => {
      describe('with disablePermissionsOmissions false', () => {
        beforeAll(async () => {
          filter = fieldPermissionsEnumFilter({
            config: {
              ...defaultFilterContext,
              fetchProfile: buildFetchProfile({
                fetchParams: {
                  optionalFeatures: {
                    disablePermissionsOmissions: false,
                  },
                },
              }),
            },
          }) as FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
          profileInstanceClone = profileInstance.clone()
          profileObjectClone = profileObj.clone()
          elements = [profileObjectClone, profileInstanceClone]
          await filter.onFetch(elements)
        })

        it('should omit the fieldPermissions from the instance', () => {
          expect(profileInstanceClone.value.fieldPermissions).toBeEmpty()
        })
      })

      describe('with disablePermissionsOmissions true', () => {
        beforeAll(async () => {
          filter = fieldPermissionsEnumFilter({
            config: buildFilterContext({
              optionalFeatures: {
                disablePermissionsOmissions: true,
              },
            }),
          }) as FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
          profileInstanceClone = profileInstance.clone()
          profileObjectClone = profileObj.clone()
          elements = [profileObjectClone, profileInstanceClone]
          await filter.onFetch(elements)
        })

        it('should not omit the fieldPermissions from the instance', () => {
          expect(profileInstanceClone.value.fieldPermissions).not.toBeEmpty()
        })
      })
    })
  })

  describe('deploy (pre + on)', () => {
    const permissionSetObjectPostOnFetch = new ObjectType({
      elemID: new ElemID(SALESFORCE, PERMISSION_SET_METADATA_TYPE),
      fields: {
        fieldPermissions: {
          refType: new MapType(new MapType(enumFieldPermissions)),
        },
      },
      annotations: {
        [METADATA_TYPE]: PERMISSION_SET_METADATA_TYPE,
      },
    })
    const profileObjectPostOnFetch = new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, constants.PROFILE_METADATA_TYPE),
      fields: {
        fieldPermissions: {
          refType: new MapType(new MapType(enumFieldPermissions)),
        },
      },
      annotations: {
        [constants.METADATA_TYPE]: constants.PROFILE_METADATA_TYPE,
      },
    })
    const profileInstancePostOnFetch = new InstanceElement('profileInstPostOnFetch', profileObjectPostOnFetch, {
      fieldPermissions: fieldPermissionEnumValue,
    })
    const permissionSetInstancePostOnFetch = new InstanceElement(
      'permissionSetInstPostOnFetch',
      permissionSetObjectPostOnFetch,
      {
        fieldPermissions: fieldPermissionEnumValue,
      },
    )
    let changes: Change<InstanceElement>[]

    describe("with instances and types that had this filter's onFetch run on them", () => {
      beforeAll(async () => {
        filter = fieldPermissionsEnumFilter({
          config: defaultFilterContext,
        }) as FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
        changes = [profileInstancePostOnFetch, permissionSetInstancePostOnFetch].map(elem =>
          toChange({ after: elem.clone() }),
        )
      })

      describe('preDeploy', () => {
        beforeAll(async () => {
          await filter.preDeploy(changes)
        })

        it('should have instances with fieldPermission Object values', async () => {
          changes.forEach(change => {
            const instance = getChangeData(change)
            expect(instance.value.fieldPermissions).toEqual(fieldPermissionObjectValue)
          })
        })

        it("should have instances' type fieldPermission field type as profileFieldLevelSecurity map type", async () => {
          await awu(changes).forEach(async change => {
            const fieldPermissionsFieldType = await (
              await getChangeData(change).getType()
            ).fields.fieldPermissions.getType()
            expect(isMapType(fieldPermissionsFieldType)).toBeTruthy()
            const deepInnerFieldPermissionType = await getDeepInnerType(fieldPermissionsFieldType)
            expect(deepInnerFieldPermissionType.elemID.isEqual(profileFieldLevelSecurity.elemID)).toBeTruthy()
          })
        })
      })

      describe('onDeploy', () => {
        beforeAll(async () => {
          await filter.onDeploy(changes)
        })

        it('should have instances with fieldPermission Enum values', () => {
          changes.forEach(change => {
            const instance = getChangeData(change)
            expect(instance.value.fieldPermissions).toEqual(fieldPermissionEnumValue)
          })
        })

        it("should have instances' type fieldPermission field type as enumFieldPermissions map type", async () => {
          await awu(changes).forEach(async change => {
            const fieldPermissionsFieldType = await (
              await getChangeData(change).getType()
            ).fields.fieldPermissions.getType()
            expect(isMapType(fieldPermissionsFieldType)).toBeTruthy()
            const deepInnerFieldPermissionType = await getDeepInnerType(fieldPermissionsFieldType)
            expect(deepInnerFieldPermissionType.elemID.isEqual(enumFieldPermissions.elemID)).toBeTruthy()
          })
        })
      })
    })

    describe("with instances and types that did not have this filter's onFetch run on them", () => {
      beforeAll(async () => {
        filter = fieldPermissionsEnumFilter({
          config: defaultFilterContext,
        }) as FilterWith<'onFetch' | 'onDeploy' | 'preDeploy'>
        changes = [profileInstance, permissionSetInstance].map(elem => toChange({ after: elem.clone() }))
      })

      describe('preDeploy', () => {
        beforeAll(async () => {
          await filter.preDeploy(changes)
        })

        it('should have instances with fieldPermission Object values', () => {
          changes.forEach(change => {
            const instance = getChangeData(change)
            expect(instance.value.fieldPermissions).toEqual(fieldPermissionObjectValue)
          })
        })

        it("should have instances' type fieldPermission field type as profileFieldLevelSecurity map type", async () => {
          await awu(changes).forEach(async change => {
            const fieldPermissionsFieldType = await (
              await getChangeData(change).getType()
            ).fields.fieldPermissions.getType()
            expect(isMapType(fieldPermissionsFieldType)).toBeTruthy()
            const deepInnerFieldPermissionType = await getDeepInnerType(fieldPermissionsFieldType)
            expect(deepInnerFieldPermissionType.elemID.isEqual(profileFieldLevelSecurity.elemID)).toBeTruthy()
          })
        })
      })

      describe('onDeploy', () => {
        beforeAll(async () => {
          await filter.onDeploy(changes)
        })

        it('should have instances with fieldPermission Object values', () => {
          changes.forEach(change => {
            const instance = getChangeData(change)
            expect(instance.value.fieldPermissions).toEqual(fieldPermissionObjectValue)
          })
        })

        it("should have instances' type fieldPermission field type as profileFieldLevelSecurity map type", async () => {
          await awu(changes).forEach(async change => {
            const fieldPermissionsFieldType = await (
              await getChangeData(change).getType()
            ).fields.fieldPermissions.getType()
            expect(isMapType(fieldPermissionsFieldType)).toBeTruthy()
            const deepInnerFieldPermissionType = await getDeepInnerType(fieldPermissionsFieldType)
            expect(deepInnerFieldPermissionType.elemID.isEqual(profileFieldLevelSecurity.elemID)).toBeTruthy()
          })
        })
      })
    })
  })
})
