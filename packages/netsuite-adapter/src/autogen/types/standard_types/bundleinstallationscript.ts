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

export const bundleinstallationscriptType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const bundleinstallationscriptElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript')
  const bundleinstallationscript_customplugintypes_plugintypeElemID = new ElemID(
    constants.NETSUITE,
    'bundleinstallationscript_customplugintypes_plugintype',
  )

  const bundleinstallationscript_customplugintypes_plugintype = new ObjectType({
    elemID: bundleinstallationscript_customplugintypes_plugintypeElemID,
    annotations: {},
    fields: {
      plugintype: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field accepts references to the plugintype custom type. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
  })

  innerTypes.bundleinstallationscript_customplugintypes_plugintype =
    bundleinstallationscript_customplugintypes_plugintype

  const bundleinstallationscript_customplugintypesElemID = new ElemID(
    constants.NETSUITE,
    'bundleinstallationscript_customplugintypes',
  )

  const bundleinstallationscript_customplugintypes = new ObjectType({
    elemID: bundleinstallationscript_customplugintypesElemID,
    annotations: {},
    fields: {
      plugintype: {
        refType: createRefToElmWithValue(new ListType(bundleinstallationscript_customplugintypes_plugintype)),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
  })

  innerTypes.bundleinstallationscript_customplugintypes = bundleinstallationscript_customplugintypes

  const bundleinstallationscript_libraries_libraryElemID = new ElemID(
    constants.NETSUITE,
    'bundleinstallationscript_libraries_library',
  )

  const bundleinstallationscript_libraries_library = new ObjectType({
    elemID: bundleinstallationscript_libraries_libraryElemID,
    annotations: {},
    fields: {
      scriptfile: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field must reference a .js file. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
  })

  innerTypes.bundleinstallationscript_libraries_library = bundleinstallationscript_libraries_library

  const bundleinstallationscript_librariesElemID = new ElemID(constants.NETSUITE, 'bundleinstallationscript_libraries')

  const bundleinstallationscript_libraries = new ObjectType({
    elemID: bundleinstallationscript_librariesElemID,
    annotations: {},
    fields: {
      library: {
        refType: createRefToElmWithValue(new ListType(bundleinstallationscript_libraries_library)),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
  })

  innerTypes.bundleinstallationscript_libraries = bundleinstallationscript_libraries

  const bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID =
    new ElemID(
      constants.NETSUITE,
      'bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter',
    )

  const bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter =
    new ObjectType({
      elemID: bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
      annotations: {},
      fields: {
        fldfilter: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
          annotations: {
            [CORE_ANNOTATIONS.REQUIRED]: true,
          },
        } /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */,
        fldfilterchecked: {
          refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
          annotations: {},
        } /* Original description: The default value is F. */,
        fldfiltercomparetype: {
          refType: createRefToElmWithValue(enums.generic_customfield_fldfiltercomparetype),
          annotations: {},
        } /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */,
        fldfiltersel: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
          annotations: {},
        } /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */,
        fldfilterval: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING),
          annotations: {},
        },
        fldfilternotnull: {
          refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
          annotations: {},
        } /* Original description: The default value is F. */,
        fldfilternull: {
          refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
          annotations: {},
        } /* Original description: The default value is F. */,
        fldcomparefield: {
          refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
          annotations: {},
        } /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */,
      },
      path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
    })

  innerTypes.bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter =
    bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter

  const bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID = new ElemID(
    constants.NETSUITE,
    'bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters',
  )

  const bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters = new ObjectType({
    elemID: bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
    annotations: {},
    fields: {
      customfieldfilter: {
        refType: createRefToElmWithValue(
          new ListType(
            bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter,
          ),
        ),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
  })

  innerTypes.bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters =
    bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters

  const bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID = new ElemID(
    constants.NETSUITE,
    'bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess',
  )

  const bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess = new ObjectType({
    elemID: bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
    annotations: {},
    fields: {
      role: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */,
      accesslevel: {
        refType: createRefToElmWithValue(enums.generic_accesslevel_searchlevel),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */,
      searchlevel: {
        refType: createRefToElmWithValue(enums.generic_accesslevel_searchlevel),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
  })

  innerTypes.bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess =
    bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess

  const bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID = new ElemID(
    constants.NETSUITE,
    'bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses',
  )

  const bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses = new ObjectType({
    elemID: bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
    annotations: {},
    fields: {
      roleaccess: {
        refType: createRefToElmWithValue(
          new ListType(bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
        ),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
  })

  innerTypes.bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses =
    bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses

  const bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID = new ElemID(
    constants.NETSUITE,
    'bundleinstallationscript_scriptcustomfields_scriptcustomfield',
  )

  const bundleinstallationscript_scriptcustomfields_scriptcustomfield = new ObjectType({
    elemID: bundleinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
        },
      } /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custscript’. */,
      fieldtype: {
        refType: createRefToElmWithValue(enums.generic_customfield_fieldtype),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */,
      label: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 200 }),
        },
      } /* Original description: This field value can be up to 200 characters long.   This field accepts references to the string custom type. */,
      selectrecordtype: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {},
      } /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */,
      applyformatting: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is T. */,
      defaultchecked: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      defaultselection: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {},
      } /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */,
      defaultvalue: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {},
      },
      description: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {},
      },
      displaytype: {
        refType: createRefToElmWithValue(enums.generic_customfield_displaytype),
        annotations: {},
      } /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */,
      dynamicdefault: {
        refType: createRefToElmWithValue(enums.generic_customfield_dynamicdefault),
        annotations: {},
      } /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */,
      help: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {},
      } /* Original description: This field accepts references to the string custom type. */,
      linktext: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {},
      },
      minvalue: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {},
      },
      maxvalue: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {},
      },
      storevalue: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is T. */,
      accesslevel: {
        refType: createRefToElmWithValue(enums.generic_accesslevel_searchlevel),
        annotations: {},
      } /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */,
      checkspelling: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      displayheight: {
        refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
        annotations: {},
      } /* Original description: This field value must be greater than or equal to 0. */,
      displaywidth: {
        refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
        annotations: {},
      } /* Original description: This field value must be greater than or equal to 0. */,
      isformula: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      ismandatory: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      maxlength: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {},
      },
      onparentdelete: {
        refType: createRefToElmWithValue(enums.generic_customfield_onparentdelete),
        annotations: {},
      } /* Original description: For information about possible values, see generic_customfield_onparentdelete. */,
      searchcomparefield: {
        refType: createRefToElmWithValue(enums.generic_standard_field),
        annotations: {},
      } /* Original description: For information about possible values, see generic_standard_field. */,
      searchdefault: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {},
      } /* Original description: This field accepts references to the savedsearch custom type. */,
      searchlevel: {
        refType: createRefToElmWithValue(enums.generic_accesslevel_searchlevel),
        annotations: {},
      } /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */,
      setting: {
        refType: createRefToElmWithValue(enums.script_setting),
        annotations: {},
      } /* Original description: For information about possible values, see script_setting. */,
      customfieldfilters: {
        refType: createRefToElmWithValue(
          bundleinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters,
        ),
        annotations: {},
      },
      roleaccesses: {
        refType: createRefToElmWithValue(bundleinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
  })

  innerTypes.bundleinstallationscript_scriptcustomfields_scriptcustomfield =
    bundleinstallationscript_scriptcustomfields_scriptcustomfield

  const bundleinstallationscript_scriptcustomfieldsElemID = new ElemID(
    constants.NETSUITE,
    'bundleinstallationscript_scriptcustomfields',
  )

  const bundleinstallationscript_scriptcustomfields = new ObjectType({
    elemID: bundleinstallationscript_scriptcustomfieldsElemID,
    annotations: {},
    fields: {
      scriptcustomfield: {
        refType: createRefToElmWithValue(new ListType(bundleinstallationscript_scriptcustomfields_scriptcustomfield)),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
  })

  innerTypes.bundleinstallationscript_scriptcustomfields = bundleinstallationscript_scriptcustomfields

  const bundleinstallationscript_scriptdeployments_scriptdeploymentElemID = new ElemID(
    constants.NETSUITE,
    'bundleinstallationscript_scriptdeployments_scriptdeployment',
  )

  const bundleinstallationscript_scriptdeployments_scriptdeployment = new ObjectType({
    elemID: bundleinstallationscript_scriptdeployments_scriptdeploymentElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
        },
      } /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customdeploy’. */,
      status: {
        refType: createRefToElmWithValue(enums.script_status),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */,
      title: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      isdeployed: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is T. */,
      loglevel: {
        refType: createRefToElmWithValue(enums.script_loglevel),
        annotations: {},
      } /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */,
      runasrole: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {},
      } /* Original description: This field accepts references to the role custom type.   For information about other possible values, see generic_role. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
  })

  innerTypes.bundleinstallationscript_scriptdeployments_scriptdeployment =
    bundleinstallationscript_scriptdeployments_scriptdeployment

  const bundleinstallationscript_scriptdeploymentsElemID = new ElemID(
    constants.NETSUITE,
    'bundleinstallationscript_scriptdeployments',
  )

  const bundleinstallationscript_scriptdeployments = new ObjectType({
    elemID: bundleinstallationscript_scriptdeploymentsElemID,
    annotations: {},
    fields: {
      scriptdeployment: {
        refType: createRefToElmWithValue(new ListType(bundleinstallationscript_scriptdeployments_scriptdeployment)),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
  })

  innerTypes.bundleinstallationscript_scriptdeployments = bundleinstallationscript_scriptdeployments

  const bundleinstallationscript = new ObjectType({
    elemID: bundleinstallationscriptElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customscript[0-9a-z_]+' }),
        },
      } /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */,
      name: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 40 }),
        },
      } /* Original description: This field value can be up to 40 characters long.   This field accepts references to the string custom type. */,
      scriptfile: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was filereference */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field must reference a .js file. */,
      description: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 999 }),
        },
      } /* Original description: This field value can be up to 999 characters long.   This field accepts references to the string custom type. */,
      isinactive: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      notifyadmins: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      notifyemails: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          // [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 999 }),
        },
      } /* Original description: This field value can be up to 999 characters long. */,
      notifyowner: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is T. */,
      afterinstallfunction: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {},
      },
      afterupdatefunction: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {},
      },
      beforeinstallfunction: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {},
      },
      beforeuninstallfunction: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {},
      },
      beforeupdatefunction: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {},
      },
      customplugintypes: {
        refType: createRefToElmWithValue(bundleinstallationscript_customplugintypes),
        annotations: {},
      },
      libraries: {
        refType: createRefToElmWithValue(bundleinstallationscript_libraries),
        annotations: {},
      },
      scriptcustomfields: {
        refType: createRefToElmWithValue(bundleinstallationscript_scriptcustomfields),
        annotations: {},
      },
      scriptdeployments: {
        refType: createRefToElmWithValue(bundleinstallationscript_scriptdeployments),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, bundleinstallationscriptElemID.name],
  })

  return { type: bundleinstallationscript, innerTypes }
}
