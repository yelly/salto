/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, ChangeError, CORE_ANNOTATIONS, Field, InstanceElement, toChange } from '@salto-io/adapter-api'
import { mockTypes } from '../mock_elements'
import { API_NAME, INSTANCE_FULL_NAME_FIELD } from '../../src/constants'
import changeValidator from '../../src/change_validators/package'

describe('package change validator', () => {
  const NAMESPACE = 'testNamespace'
  const SERVICE_URL = 'https://test.lightning.force.com/lightning/_classic/%2F01p8d00000MJldAAAT'

  let managedElement: InstanceElement
  let changeErrors: readonly ChangeError[]
  beforeEach(async () => {
    managedElement = new InstanceElement(
      `${NAMESPACE}__managedFlow`,
      mockTypes.Flow,
      {
        [INSTANCE_FULL_NAME_FIELD]: `${NAMESPACE}__managedFlow`,
      },
      undefined,
      {
        [CORE_ANNOTATIONS.SERVICE_URL]: SERVICE_URL,
      },
    )
    const nonManagedElement = new InstanceElement(
      'nonManagedFlow',
      mockTypes.Flow,
      {
        [INSTANCE_FULL_NAME_FIELD]: 'nonManagedFlow',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.SERVICE_URL]: SERVICE_URL,
      },
    )

    const nonManagedCustomField = new Field(mockTypes.Account, 'NonManagedField', BuiltinTypes.STRING, {
      [API_NAME]: 'Account.NonManagedField__c',
    })
    changeErrors = await changeValidator(
      [managedElement, nonManagedElement, nonManagedCustomField].map(e => toChange({ after: e })),
    )
  })
  it('should create change warning on elements from managed package', () => {
    expect(changeErrors).toEqual([
      expect.objectContaining({
        elemID: managedElement.elemID,
        severity: 'Warning',
        detailedMessage: expect.stringContaining(NAMESPACE) && expect.stringContaining(SERVICE_URL),
      }),
    ])
  })
})
