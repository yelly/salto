/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { entraConstants } from '../../constants'
import { mapMemberRefToChangeData } from '../shared'
import { deployArrayFieldsFilterCreator } from '../shared/array_fields_deployment'

const {
  TOP_LEVEL_TYPES: { ADMINISTRATIVE_UNIT_TYPE_NAME },
  MEMBERS_FIELD_NAME,
  ADMINISTRATIVE_UNIT_MEMBERS_TYPE_NAME,
} = entraConstants

export const deployAdministrativeUnitMembersFilter = deployArrayFieldsFilterCreator({
  topLevelTypeName: ADMINISTRATIVE_UNIT_TYPE_NAME,
  fieldName: MEMBERS_FIELD_NAME,
  fieldTypeName: ADMINISTRATIVE_UNIT_MEMBERS_TYPE_NAME,
  valueMapper: mapMemberRefToChangeData,
})
