/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { OptionalFeatures } from '../types'

type OptionalFeaturesDefaultValues = {
  [FeatureName in keyof OptionalFeatures]?: boolean
}

const optionalFeaturesDefaultValues: OptionalFeaturesDefaultValues = {
  skipAliases: false,
  extendedCustomFieldInformation: false,
  importantValues: true,
  hideTypesFolder: true,
  metaTypes: false,
  improvedDataBrokenReferences: true,
  skipParsingXmlNumbers: true,
  logDiffsFromParsingXmlNumbers: true,
  extendTriggersMetadata: true,
  picklistsAsMaps: false,
  retrieveSettings: false,
  genAiReferences: false,
}

export const isFeatureEnabled = (name: keyof OptionalFeatures, optionalFeatures?: OptionalFeatures): boolean =>
  optionalFeatures?.[name] ?? optionalFeaturesDefaultValues[name] ?? true