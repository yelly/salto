/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
/* eslint-disable max-len */
/* eslint-disable camelcase */
import {
  BuiltinTypes,
  createRefToElmWithValue,
  CORE_ANNOTATIONS,
  ElemID,
  ObjectType,
  createRestriction,
  ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../../constants'
import { TypeAndInnerTypes } from '../../../types/object_types'
import { enums } from '../enums'

export const centertabType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const centertabElemID = new ElemID(constants.NETSUITE, 'centertab')
  const centertab_portlets_portletElemID = new ElemID(constants.NETSUITE, 'centertab_portlets_portlet')

  const centertab_portlets_portlet = new ObjectType({
    elemID: centertab_portlets_portletElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
        },
      } /* Original description: This attribute value can be up to 40 characters long. */,
      portlet: {
        refType: createRefToElmWithValue(enums.generic_portlet),
        annotations: {},
      } /* Original description: For information about possible values, see generic_portlet. */,
      portletcolumn: {
        refType: createRefToElmWithValue(enums.generic_portletcolumn),
        annotations: {},
      } /* Original description: For information about possible values, see generic_portletcolumn. */,
      isportletshown: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is T. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, centertabElemID.name],
  })

  innerTypes.centertab_portlets_portlet = centertab_portlets_portlet

  const centertab_portletsElemID = new ElemID(constants.NETSUITE, 'centertab_portlets')

  const centertab_portlets = new ObjectType({
    elemID: centertab_portletsElemID,
    annotations: {},
    fields: {
      portlet: {
        refType: createRefToElmWithValue(new ListType(centertab_portlets_portlet)),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, centertabElemID.name],
  })

  innerTypes.centertab_portlets = centertab_portlets

  const centertab = new ObjectType({
    elemID: centertabElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custcentertab[0-9a-z_]+' }),
        },
      } /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custcentertab’. */,
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field accepts references to the string custom type. */,
      center: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field accepts references to the center custom type.   For information about other possible values, see generic_centertype. */,
      allvendors: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      allroles: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      allpartners: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account. */,
      allcustomers: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      allemployees: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      audslctrole: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
        annotations: {},
      } /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type.   For information about other possible values, see generic_role. */,
      portlets: {
        refType: createRefToElmWithValue(centertab_portlets),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, centertabElemID.name],
  })

  return { type: centertab, innerTypes }
}
