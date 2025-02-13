/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, getAllChangeData, toChange } from '@salto-io/adapter-api'
import changeValidator from '../../src/change_validators/full_name_changed'
import { mockTypes } from '../mock_elements'
import { createInstanceElement } from '../../src/transformers/transformer'
import { INSTANCE_FULL_NAME_FIELD } from '../../src/constants'

describe('fullName change validator', () => {
  describe('when fullName changes', () => {
    let fullNameChange: Change
    beforeEach(() => {
      const beforeRecord = createInstanceElement({ fullName: 'original_full_name' }, mockTypes.RecordType)
      const afterRecord = beforeRecord.clone()
      afterRecord.value[INSTANCE_FULL_NAME_FIELD] = 'modified_full_name'
      fullNameChange = toChange({ before: beforeRecord, after: afterRecord })
    })

    it('should fail validation', async () => {
      const changeErrors = await changeValidator([fullNameChange])
      expect(changeErrors).toHaveLength(1)
      const [changeError] = changeErrors
      const [beforeData] = getAllChangeData(fullNameChange)
      expect(changeError.elemID).toEqual(beforeData?.elemID)
      expect(changeError.severity).toEqual('Error')
    })
  })
  describe('when fullName does not change', () => {
    let fullNameChange: Change
    beforeEach(() => {
      const beforeRecord = createInstanceElement({ fullName: 'original_full_name', status: 'ACTIVE' }, mockTypes.Flow)
      const afterRecord = beforeRecord.clone()
      afterRecord.value.status = 'INACTIVE'
      fullNameChange = toChange({ before: beforeRecord, after: afterRecord })
    })

    it('should pass validation', async () => {
      const changeErrors = await changeValidator([fullNameChange])
      expect(changeErrors).toBeEmpty()
    })
  })
})
