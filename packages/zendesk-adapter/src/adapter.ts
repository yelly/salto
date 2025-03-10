/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _, { isString } from 'lodash'
import {
  AdapterOperations,
  Change,
  ChangeGroup,
  DeployModifiers,
  DeployOptions,
  DeployResult,
  Element,
  ElemIdGetter,
  FetchOptions,
  FetchResult,
  FixElementsFunc,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression,
  isSaltoError,
  ReadOnlyElementsSource,
  SaltoError,
} from '@salto-io/adapter-api'
import {
  client as clientUtils,
  combineElementFixers,
  elements as elementUtils,
  resolveChangeElement,
  resolveValues,
  definitions as definitionsUtils,
  fetch as fetchUtils,
  restoreChangeElement,
} from '@salto-io/adapter-components'
import { ERROR_MESSAGES, getElemIdFuncWrapper, inspectValue, logDuration } from '@salto-io/adapter-utils'
import { collections, objects } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import ZendeskClient from './client/client'
import { BrandIdToClient, Filter, FilterCreator, FilterResult, filterRunner } from './filter'
import {
  API_DEFINITIONS_CONFIG,
  CLIENT_CONFIG,
  configType,
  DEPLOY_CONFIG,
  FETCH_CONFIG,
  GUIDE_BRAND_SPECIFIC_TYPES,
  GUIDE_SUPPORTED_TYPES,
  GUIDE_TYPES_TO_HANDLE_BY_BRAND,
  isGuideEnabled,
  isGuideThemesEnabled,
  ZendeskConfig,
} from './config'
import {
  ARTICLE_ATTACHMENT_TYPE_NAME,
  CONVERSATION_BOT,
  BRAND_LOGO_TYPE_NAME,
  BRAND_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME,
  DEFAULT_CUSTOM_STATUSES_TYPE_NAME,
  GUIDE_THEME_TYPE_NAME,
  LOCALE_TYPE_NAME,
  THEME_SETTINGS_TYPE_NAME,
  ZENDESK,
} from './constants'
import { getBrandsForGuide } from './filters/utils'
import { GUIDE_ORDER_TYPES } from './filters/guide_order/guide_order_utils'
import createChangeValidator from './change_validator'
import { paginate } from './client/pagination'
import fetchCriteria from './fetch_criteria'
import { getChangeGroupIds } from './group_change'
import fieldReferencesFilter, { lookupFunc } from './filters/field_references'
import listValuesMissingReferencesFilter from './filters/references/list_values_missing_references'
import unorderedListsFilter from './filters/unordered_lists'
import viewFilter from './filters/view'
import workspaceFilter from './filters/workspace'
import ticketFormOrderFilter from './filters/reorder/ticket_form'
import userFieldOrderFilter from './filters/reorder/user_field'
import organizationFieldOrderFilter from './filters/reorder/organization_field'
import workspaceOrderFilter from './filters/reorder/workspace'
import slaPolicyOrderFilter from './filters/reorder/sla_policy'
import automationOrderFilter from './filters/reorder/automation'
import triggerOrderFilter from './filters/reorder/trigger'
import viewOrderFilter from './filters/reorder/view'
import queueOrderFilter from './filters/reorder/queue'
import businessHoursScheduleFilter from './filters/business_hours_schedule'
import omitCollisionFilter from './filters/omit_collision'
import accountSettingsFilter from './filters/account_settings'
import ticketFieldFilter from './filters/custom_field_options/ticket_field'
import userFieldFilter from './filters/custom_field_options/user_field'
import dynamicContentFilter from './filters/dynamic_content'
import dynamicContentReferencesFilter from './filters/dynamic_content_references'
import restrictionFilter from './filters/restriction'
import organizationFieldFilter from './filters/custom_field_options/organization_field'
import removeDefinitionInstancesFilter from './filters/remove_definition_instances'
import hardcodedChannelFilter from './filters/hardcoded_channel'
import usersFilter from './filters/user'
import addFieldOptionsFilter from './filters/add_field_options'
import appOwnedConvertListToMapFilter from './filters/app_owned_convert_list_to_map'
import appInstallationsFilter from './filters/app_installations'
import routingAttributeFilter from './filters/routing_attribute'
import serviceUrlFilter from './filters/service_url'
import slaPolicyFilter from './filters/sla_policy'
import macroAttachmentsFilter from './filters/macro_attachments'
import tagsFilter from './filters/tag'
import guideLocalesFilter from './filters/guide_locale'
import webhookFilter from './filters/webhook'
import targetFilter from './filters/target'
import defaultDeployFilter from './filters/default_deploy'
import defaultDeployDefinitionsFilter from './filters/default_deploy_definitions'
import commonFilters from './filters/common'
import handleTemplateExpressionFilter from './filters/handle_template_expressions'
import handleAppInstallationsFilter from './filters/handle_app_installations'
import brandLogoFilter from './filters/brand_logo'
import articleFilter from './filters/article/article'
import articleBodyFilter from './filters/article/article_body'
import { dependencyChanger } from './dependency_changers'
import deployBrandedGuideTypesFilter from './filters/deploy_branded_guide_types'
import deployTriggerSkills from './filters/deploy_trigger_skills'
import { Credentials } from './auth'
import guideSectionCategoryFilter from './filters/guide_section_and_category'
import guideTranslationFilter from './filters/guide_translation'
import guideThemeFilter from './filters/guide_theme'
import fetchCategorySection from './filters/guide_fetch_article_section_and_category'
import guideParentSection from './filters/guide_parent_to_section'
import guideGuideSettings from './filters/guide_guide_settings'
import removeBrandLogoFilter from './filters/remove_brand_logo_field'
import categoryOrderFilter from './filters/guide_order/category_order'
import sectionOrderFilter from './filters/guide_order/section_order'
import articleOrderFilter from './filters/guide_order/article_order'
import guideServiceUrl from './filters/guide_service_url'
import everyoneUserSegmentFilter from './filters/everyone_user_segment'
import guideArrangePaths from './filters/guide_arrange_paths'
import guideDefaultLanguage from './filters/guide_default_language_settings'
import guideAddBrandToArticleTranslation from './filters/guide_add_brand_to_translation'
import ticketFormDeploy from './filters/ticket_form'
import supportAddress from './filters/support_address'
import customStatus from './filters/custom_statuses'
import organizationsFilter from './filters/organizations'
import hideAccountFeatures from './filters/hide_account_features'
import auditTimeFilter from './filters/audit_logs'
import sideConversationsFilter from './filters/side_conversation'
import { isCurrentUserResponse } from './user_utils'
import addRemainingAliasFilter from './filters/add_alias'
import addRecurseIntoFieldFilter from './filters/add_recurse_into_field'
import macroFilter from './filters/macro'
import customRoleDeployFilter from './filters/custom_role_deploy'
import routingAttributeValueDeployFilter from './filters/routing_attribute_value'
import localeFilter from './filters/locale'
import ticketStatusCustomStatusDeployFilter from './filters/ticket_status_custom_status'
import handleIdenticalAttachmentConflicts from './filters/handle_identical_attachment_conflicts'
import addImportantValuesFilter from './filters/add_important_values'
import customObjectFilter from './filters/custom_objects/custom_object'
import customObjectFieldFilter from './filters/custom_objects/custom_object_fields'
import customObjectFieldsOrderFilter from './filters/custom_objects/custom_object_fields_order'
import customObjectFieldOptionsFilter from './filters/custom_field_options/custom_object_field_options'
import botBuilderArrangePaths from './filters/bot_builder_arrange_paths'
import { createFixElementFunctions } from './fix_elements'
import guideThemeSettingFilter from './filters/guide_theme_settings'
import { Options } from './definitions/types'
import { createClientDefinitions, createFetchDefinitions } from './definitions'
import { PAGINATION } from './definitions/requests/pagination'
import { ZendeskFetchConfig } from './user_config'
import { filterOutInactiveItemForType } from './inactive'
import ZendeskGuideClient from './client/guide_client'
import { createDeployDefinitions } from './definitions/deploy/deploy'

const log = logger(module)
const { createPaginator } = clientUtils
const { replaceInstanceTypeForDeploy, restoreInstanceTypeFromDeploy, addRemainingTypes } = elementUtils.ducktype
const { awu } = collections.asynciterable
const { concatObjects } = objects

const DEFAULT_FILTERS = [
  addRecurseIntoFieldFilter,
  ticketStatusCustomStatusDeployFilter,
  ticketFieldFilter,
  userFieldFilter,
  viewFilter,
  workspaceFilter,
  ticketFormOrderFilter,
  userFieldOrderFilter,
  organizationFieldOrderFilter,
  workspaceOrderFilter,
  slaPolicyOrderFilter,
  automationOrderFilter,
  triggerOrderFilter,
  viewOrderFilter,
  queueOrderFilter,
  businessHoursScheduleFilter,
  accountSettingsFilter,
  dynamicContentFilter,
  restrictionFilter,
  organizationFieldFilter,
  hardcodedChannelFilter,
  auditTimeFilter, // needs to be before userFilter as it uses the ids of the users
  // removeDefinitionInstancesFilter should be after hardcodedChannelFilter
  removeDefinitionInstancesFilter,
  usersFilter,
  organizationsFilter,
  tagsFilter,
  localeFilter,
  // supportAddress should run before referencedIdFieldsFilter
  supportAddress,
  customStatus,
  guideAddBrandToArticleTranslation,
  macroFilter,
  macroAttachmentsFilter,
  ticketFormDeploy,
  customRoleDeployFilter,
  sideConversationsFilter,
  brandLogoFilter,
  // removeBrandLogoFilter should be after brandLogoFilter
  removeBrandLogoFilter,
  categoryOrderFilter,
  sectionOrderFilter,
  articleOrderFilter,
  // help center filters need to be before fieldReferencesFilter (assume fields are strings)
  // everyoneUserSegmentFilter needs to be before articleFilter
  everyoneUserSegmentFilter,
  articleFilter,
  guideSectionCategoryFilter,
  guideTranslationFilter,
  guideGuideSettings,
  guideDefaultLanguage, // needs to be after guideGuideSettings
  guideServiceUrl,
  guideLocalesFilter, // Needs to be after guideServiceUrl
  customObjectFilter,
  customObjectFieldsOrderFilter,
  customObjectFieldOptionsFilter,
  customObjectFieldFilter, // need to be after customObjectFieldOptionsFilter
  // fieldReferencesFilter should be after:
  // usersFilter, macroAttachmentsFilter, tagsFilter, guideLocalesFilter, customObjectFilter, customObjectFieldFilter
  fieldReferencesFilter,
  // listValuesMissingReferencesFilter should be after fieldReferencesFilter
  listValuesMissingReferencesFilter,
  appInstallationsFilter,
  appOwnedConvertListToMapFilter,
  slaPolicyFilter,
  routingAttributeFilter,
  routingAttributeValueDeployFilter,
  addFieldOptionsFilter,
  webhookFilter,
  targetFilter,
  // unorderedListsFilter should run after fieldReferencesFilter
  unorderedListsFilter,
  dynamicContentReferencesFilter,
  guideParentSection,
  serviceUrlFilter,
  // referencedIdFieldsFilter and queryFilter should run after element references are resolved
  ...Object.values(commonFilters),
  handleAppInstallationsFilter,
  handleTemplateExpressionFilter,
  articleBodyFilter, // needs to be after handleTemplateExpressionFilter
  // handleIdenticalAttachmentConflicts needs to be before collisionErrorsFilter and after referencedIdFieldsFilter
  // and articleBodyFilter
  handleIdenticalAttachmentConflicts,
  omitCollisionFilter, // needs to be after referencedIdFieldsFilter (which is part of the common filters)
  deployBrandedGuideTypesFilter,
  deployTriggerSkills,
  guideThemeFilter, // fetches a lot of data, so should be after omitCollisionFilter to remove theme collisions
  guideThemeSettingFilter, // needs to be after guideThemeFilter as it depends on successful theme fetches
  addRemainingAliasFilter, // should run after fieldReferencesFilter and guideThemeSettingFilter
  guideArrangePaths,
  botBuilderArrangePaths, // should run after fieldReferencesFilter
  hideAccountFeatures,
  fetchCategorySection, // need to be after arrange paths as it uses the 'name'/'title' field
  addImportantValuesFilter,
  // defaultDeployFilter and defaultDeployDefinitionsFilter should be last!
  defaultDeployFilter,
  // This catches types we moved to the new infra definitions
  defaultDeployDefinitionsFilter,
]

const SKIP_RESOLVE_TYPE_NAMES = [
  'organization_field__custom_field_options',
  CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
  'macro',
  'macro_attachment',
  'brand_logo',
  ...GUIDE_ORDER_TYPES,
]

const getBrandsFromElementsSourceNoCache = async (elementsSource: ReadOnlyElementsSource): Promise<InstanceElement[]> =>
  awu(await elementsSource.list())
    .filter(id => id.typeName === BRAND_TYPE_NAME && id.idType === 'instance')
    .map(id => elementsSource.get(id))
    .filter(isInstanceElement)
    .toArray()

/**
 * Fetch Guide (help_center) elements for the given brands.
 * Each help_center requires a different paginator.
 */
const getGuideElements = async ({
  brandFetchDefinitions,
  fetchQuery,
  getElemIdFunc,
}: {
  brandFetchDefinitions: definitionsUtils.RequiredDefinitions<Options>
  fetchQuery: elementUtils.query.ElementQuery
  getElemIdFunc?: ElemIdGetter
}): Promise<fetchUtils.FetchElements<Element[]>> => {
  const guideFetchResult = await fetchUtils.getElements({
    adapterName: ZENDESK,
    fetchQuery,
    getElemIdFunc,
    definitions: brandFetchDefinitions,
  })
  guideFetchResult.elements = guideFetchResult.elements.filter(e => !e.elemID.typeName.startsWith('brand'))
  return {
    ...guideFetchResult,
  }
}

export interface ZendeskAdapterParams {
  filterCreators?: FilterCreator[]
  client: ZendeskClient
  credentials: Credentials
  config: ZendeskConfig
  elementsSource: ReadOnlyElementsSource
  // callback function to get an existing elemId or create a new one by the ServiceIds values
  getElemIdFunc?: ElemIdGetter
  configInstance?: InstanceElement
  accountName?: string
}

export default class ZendeskAdapter implements AdapterOperations {
  private client: ZendeskClient
  private guideClient: ZendeskGuideClient | undefined
  private paginator: clientUtils.Paginator
  private userConfig: ZendeskConfig
  private getElemIdFunc?: ElemIdGetter
  private configInstance?: InstanceElement
  private elementsSource: ReadOnlyElementsSource
  private fetchQuery: elementUtils.query.ElementQuery
  private logIdsFunc?: () => void
  private fixElementsFunc: FixElementsFunc
  private createClientBySubdomain: (subdomain: string, deployRateLimit?: boolean) => ZendeskClient
  private getClientBySubdomain: (subdomain: string, deployRateLimit?: boolean) => ZendeskClient
  private brandsList: Promise<InstanceElement[]> | undefined
  private adapterDefinitions: definitionsUtils.RequiredDefinitions<Options>
  private fetchSupportDefinitions: definitionsUtils.RequiredDefinitions<Options>
  private accountName?: string
  private createFiltersRunner: ({
    filterRunnerClient,
    paginator,
    brandIdToClient,
  }: {
    filterRunnerClient?: ZendeskClient
    paginator?: clientUtils.Paginator
    brandIdToClient?: BrandIdToClient
  }) => Promise<Required<Filter>>

  public constructor({
    filterCreators = DEFAULT_FILTERS,
    client,
    credentials,
    getElemIdFunc,
    config,
    configInstance,
    elementsSource,
    accountName,
  }: ZendeskAdapterParams) {
    const wrapper = getElemIdFunc ? getElemIdFuncWrapper(getElemIdFunc) : undefined
    this.userConfig = config
    this.configInstance = configInstance
    this.getElemIdFunc = wrapper?.getElemIdFunc
    this.logIdsFunc = wrapper?.logIdsFunc
    this.client = client
    this.elementsSource = elementsSource
    this.brandsList = undefined
    this.guideClient = undefined
    this.paginator = createPaginator({
      client: this.client,
      paginationFuncCreator: paginate,
    })
    this.accountName = accountName

    this.createClientBySubdomain = (subdomain: string, deployRateLimit = false): ZendeskClient => {
      const clientConfig = { ...this.userConfig[CLIENT_CONFIG] }
      if (deployRateLimit) {
        // Concurrent requests with Guide elements may cause 409 errors (SALTO-2961)
        Object.assign(clientConfig, { rateLimit: { deploy: 1 } })
      }
      return new ZendeskClient({
        credentials: { ...credentials, subdomain },
        config: clientConfig,
        allowOrganizationNames: this.userConfig[FETCH_CONFIG].resolveOrganizationIDs,
      })
    }

    const typesToOmit = this.getNonSupportedTypesToOmit()

    this.adapterDefinitions = definitionsUtils.mergeDefinitionsWithOverrides(
      {
        // we can't add guide client at this point
        clients: createClientDefinitions({ main: this.client, guide: this.client }),
        pagination: PAGINATION,
        fetch: definitionsUtils.mergeWithUserElemIDDefinitions({
          userElemID: this.userConfig.fetch.elemID,
          fetchConfig: createFetchDefinitions({ baseUrl: this.client.getUrl().href }),
        }),
        deploy: createDeployDefinitions(),
      },
      this.accountName,
    )
    this.fetchSupportDefinitions = definitionsUtils.mergeDefinitionsWithOverrides(
      {
        // Support does not need guide client
        clients: createClientDefinitions({ main: this.client, guide: this.client }),
        pagination: PAGINATION,
        fetch: definitionsUtils.mergeWithUserElemIDDefinitions({
          userElemID: _.omit(this.userConfig.fetch.elemID, typesToOmit) as ZendeskFetchConfig['elemID'],
          fetchConfig: createFetchDefinitions({ typesToOmit, baseUrl: this.client.getUrl().href }),
        }),
      },
      this.accountName,
    )
    const clientsBySubdomain: Record<string, ZendeskClient> = {}
    this.getClientBySubdomain = (subdomain: string, deployRateLimit = false): ZendeskClient => {
      if (clientsBySubdomain[subdomain] === undefined) {
        clientsBySubdomain[subdomain] = this.createClientBySubdomain(subdomain, deployRateLimit)
      }
      return clientsBySubdomain[subdomain]
    }
    const fetchConfig = this.userConfig[FETCH_CONFIG]
    if (fetchConfig.fetchBotBuilder === false) {
      fetchConfig.exclude.push({ type: CONVERSATION_BOT })
    }
    this.fetchQuery = elementUtils.query.createElementQuery(fetchConfig, fetchCriteria)

    this.createFiltersRunner = async ({
      filterRunnerClient,
      paginator,
      brandIdToClient = {},
    }: {
      filterRunnerClient?: ZendeskClient
      paginator?: clientUtils.Paginator
      brandIdToClient?: BrandIdToClient
    }) =>
      filterRunner(
        {
          fetchQuery: this.fetchQuery,
          definitions: this.adapterDefinitions,
          paginator: paginator ?? this.paginator,
          config: this.userConfig,
          getElemIdFunc: this.getElemIdFunc,
          elementSource: elementsSource,
          sharedContext: {},
          oldApiDefinitions: this.userConfig[API_DEFINITIONS_CONFIG],
          client: filterRunnerClient ?? this.client,
          brandIdToClient,
        },
        filterCreators,
        concatObjects,
      )

    this.fixElementsFunc = combineElementFixers(
      createFixElementFunctions({
        client,
        config,
        elementsSource,
      }),
      config.fixElements,
    )
  }

  private getNonSupportedTypesToOmit(): string[] {
    const isGuideEnabledInConfig = isGuideEnabled(this.userConfig[FETCH_CONFIG])
    const isGuideThemesEnabledInConfig = isGuideThemesEnabled(this.userConfig[FETCH_CONFIG])
    const keysToOmit = isGuideEnabledInConfig
      ? GUIDE_TYPES_TO_HANDLE_BY_BRAND.map(type => type) // we don't want to remove permission_group and user_segment and theme
      : Object.keys(GUIDE_SUPPORTED_TYPES)
    if (!isGuideThemesEnabledInConfig) {
      keysToOmit.push(GUIDE_THEME_TYPE_NAME)
    }
    return keysToOmit
  }

  private filterSupportedTypes(): Record<string, string[]> {
    const keysToOmit = this.getNonSupportedTypesToOmit()
    const { supportedTypes: allSupportedTypes } = this.userConfig.apiDefinitions
    return _.omit(allSupportedTypes, ...keysToOmit)
  }

  @logDuration('generating instances and types from service')
  private async getElements(): Promise<ReturnType<typeof fetchUtils.getElements>> {
    const isGuideEnabledInConfig = isGuideEnabled(this.userConfig[FETCH_CONFIG])
    const isGuideInFetch = isGuideEnabledInConfig && !_.isEmpty(this.userConfig[FETCH_CONFIG].guide?.brands)
    const supportedTypes = this.filterSupportedTypes()

    const defaultSubdomainResult = await fetchUtils.getElements({
      adapterName: ZENDESK,
      fetchQuery: this.fetchQuery,
      getElemIdFunc: this.getElemIdFunc,
      definitions: this.fetchSupportDefinitions,
      customItemFilter: filterOutInactiveItemForType(this.userConfig),
    })
    if (!isGuideInFetch) {
      addRemainingTypes({
        adapterName: ZENDESK,
        elements: defaultSubdomainResult.elements,
        typesConfig: this.userConfig.apiDefinitions.types,
        supportedTypes,
        typeDefaultConfig: this.userConfig.apiDefinitions.typeDefaults,
      })
      return defaultSubdomainResult
    }

    const combinedRes = {
      configChanges: defaultSubdomainResult.configChanges ?? [],
      elements: defaultSubdomainResult.elements,
      errors: defaultSubdomainResult.errors ?? [],
    }

    const brandsList = getBrandsForGuide(
      defaultSubdomainResult.elements.filter(isInstanceElement),
      this.userConfig[FETCH_CONFIG],
    )

    if (_.isEmpty(brandsList)) {
      const brandPatterns = Array.from(this.userConfig[FETCH_CONFIG].guide?.brands ?? []).join(', ')
      const detailedMessage = `Could not find any brands matching the included patterns: [${brandPatterns}]. Please update the configuration under fetch.guide.brands in the configuration file`
      log.warn(detailedMessage)
      combinedRes.errors = combinedRes.errors.concat([
        {
          message: ERROR_MESSAGES.OTHER_ISSUES,
          detailedMessage,
          severity: 'Warning',
        },
      ])
    } else {
      const brandClients = Object.fromEntries(
        brandsList.map(brandInstance => [
          brandInstance.value.id,
          this.createClientBySubdomain(brandInstance.value.subdomain),
        ]),
      )
      const typesToPick = GUIDE_TYPES_TO_HANDLE_BY_BRAND.concat([
        'guide_settings__help_center',
        'guide_settings__help_center__settings',
        'guide_settings__help_center__text_filter',
        'brand',
      ])
      this.guideClient = new ZendeskGuideClient(brandClients)
      const guideFetchDef = definitionsUtils.mergeWithUserElemIDDefinitions({
        userElemID: _.pick(this.userConfig.fetch.elemID, typesToPick) as ZendeskFetchConfig['elemID'],
        fetchConfig: createFetchDefinitions({ typesToPick, baseUrl: this.client.getUrl().href }),
      })
      const guideDefinitions = definitionsUtils.mergeDefinitionsWithOverrides(
        {
          clients: createClientDefinitions({
            main: this.client,
            guide: this.guideClient,
          }),
          pagination: PAGINATION,
          fetch: guideFetchDef,
        },
        this.accountName,
      )

      const zendeskGuideElements = await getGuideElements({
        brandFetchDefinitions: guideDefinitions,
        fetchQuery: this.fetchQuery,
        getElemIdFunc: this.getElemIdFunc,
      })

      combinedRes.configChanges = combinedRes.configChanges.concat(zendeskGuideElements.configChanges ?? [])
      combinedRes.elements = combinedRes.elements.concat(zendeskGuideElements.elements)
      combinedRes.errors = combinedRes.errors.concat(zendeskGuideElements.errors ?? [])
    }

    // Remaining types should be added once to avoid overlaps between the generated elements,
    // so we add them once after all elements are generated
    addRemainingTypes({
      adapterName: ZENDESK,
      elements: combinedRes.elements,
      typesConfig: this.userConfig.apiDefinitions.types,
      supportedTypes: _.merge(supportedTypes, GUIDE_BRAND_SPECIFIC_TYPES),
      typeDefaultConfig: this.userConfig.apiDefinitions.typeDefaults,
    })

    return combinedRes
  }

  private async isLocaleEnUs(): Promise<SaltoError | undefined> {
    try {
      const res = (
        await this.client.get({
          url: '/api/v2/users/me',
        })
      ).data
      if (isCurrentUserResponse(res)) {
        if (res.user.locale !== 'en-US') {
          return {
            message: ERROR_MESSAGES.OTHER_ISSUES,
            detailedMessage:
              "You are fetching zendesk with a user whose locale is set to a language different than US English. This may affect Salto's behavior in some cases. Therefore, it is highly recommended to set the user's language to \"English (United States)\" or to create another user with English as its Zendesk language and change Salto‘s credentials to use it. For help on how to change a Zendesk user's language, go to https://support.zendesk.com/hc/en-us/articles/4408835022490-Viewing-and-editing-your-user-profile-in-Zendesk-Support",
            severity: 'Warning',
          }
        }
        return undefined
      }
      log.error("could not verify fetching user's locale is set to en-US. received invalid response")
    } catch (e) {
      log.error(`could not verify fetching user's locale is set to en-US'. error: ${e}`)
    }
    return undefined
  }

  private async logSubscriptionData(): Promise<void> {
    try {
      const { data } = await this.client.get({ url: '/api/v2/account/subscription.json' })
      const subscriptionData = !_.isArray(data) ? data.subscription : undefined
      if (subscriptionData) {
        log.info(`Account subscription data: ${inspectValue(subscriptionData)}`)
      } else {
        log.info(`Account subscription data invalid: ${inspectValue(data)}`)
      }
      // This log is not crucial for the fetch to succeed, so we don't want to fail the fetch if it fails
    } catch (e) {
      if (e.response?.status === 422) {
        log.info('Account subscription data unavailable because this is a sandbox environment')
      } else {
        log.info(`Account subscription data unavailable because of an error ${inspectValue(e)}`)
      }
    }
  }

  /**
   * Fetch configuration elements in the given account.
   * Account credentials were given in the constructor.
   */
  @logDuration('fetching account configuration')
  async fetch({ progressReporter }: FetchOptions): Promise<FetchResult> {
    log.debug('going to fetch zendesk account configuration..')
    progressReporter.reportProgress({ message: 'Fetching types and instances' })
    await this.logSubscriptionData()
    const localeError = await this.isLocaleEnUs()
    const { elements, configChanges, errors } = await this.getElements()
    log.debug('going to run filters on %d fetched elements', elements.length)
    progressReporter.reportProgress({ message: 'Running filters for additional information' })
    const brandsWithHelpCenter = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === BRAND_TYPE_NAME)
      .filter(brandInstance => brandInstance.value.has_help_center)
    const brandIdToClient = Object.fromEntries(
      brandsWithHelpCenter.map(brandInstance => [
        brandInstance.value.id,
        this.createClientBySubdomain(brandInstance.value.subdomain),
      ]),
    )
    // This exposes different subdomain clients for Guide related types filters
    const result = (await (await this.createFiltersRunner({ brandIdToClient })).onFetch(elements)) as FilterResult
    const updatedConfig =
      this.configInstance && configChanges
        ? definitionsUtils.getUpdatedConfigFromConfigChanges({
            configChanges,
            currentConfig: this.configInstance,
            configType,
          })
        : undefined

    const fetchErrors = (errors ?? []).concat(result.errors ?? []).concat(localeError ?? [])
    if (this.logIdsFunc !== undefined) {
      this.logIdsFunc()
    }
    return { elements, errors: fetchErrors, updatedConfig }
  }

  private getBrandsFromElementsSource(): Promise<InstanceElement[]> {
    if (this.brandsList === undefined) {
      this.brandsList = getBrandsFromElementsSourceNoCache(this.elementsSource)
    }
    return this.brandsList
  }

  private async deployGuideChanges(
    guideResolvedChanges: Change<InstanceElement>[],
    changeGroup: ChangeGroup,
  ): Promise<DeployResult[]> {
    if (_.isEmpty(guideResolvedChanges)) {
      return []
    }
    const brandsList = await this.getBrandsFromElementsSource()
    log.debug('Found %d brands to handle %d guide changes', brandsList.length, guideResolvedChanges.length)
    const resolvedBrandIdToSubdomain = Object.fromEntries(
      brandsList.map(brandInstance => [brandInstance.value.id, brandInstance.value.subdomain]),
    )
    const subdomainToGuideChanges = _.groupBy(guideResolvedChanges, change => {
      const { brand } = getChangeData(change).value
      // If the change was in SKIP_RESOLVE_TYPE_NAMES, brand is a reference expression
      return resolvedBrandIdToSubdomain[isReferenceExpression(brand) ? brand.value.value.id : brand]
    })
    const subdomainsList = brandsList.map(brandInstance => brandInstance.value.subdomain).filter(isString)
    const subdomainToClient = Object.fromEntries(
      subdomainsList
        .filter(subdomain => subdomainToGuideChanges[subdomain] !== undefined)
        .map(subdomain => [subdomain, this.getClientBySubdomain(subdomain, true)]),
    )
    try {
      return await awu(Object.entries(subdomainToClient))
        .map(async ([subdomain, client]) => {
          const brandRunner = await this.createFiltersRunner({
            filterRunnerClient: client,
            paginator: createPaginator({
              client,
              paginationFuncCreator: paginate,
            }),
          })
          await brandRunner.preDeploy(subdomainToGuideChanges[subdomain])
          const { deployResult: brandDeployResults } = await brandRunner.deploy(
            subdomainToGuideChanges[subdomain],
            changeGroup,
          )
          const guideChangesBeforeRestore = [...brandDeployResults.appliedChanges]
          try {
            await brandRunner.onDeploy(guideChangesBeforeRestore)
          } catch (e) {
            if (!isSaltoError(e)) {
              throw e
            }
            brandDeployResults.errors = brandDeployResults.errors.concat([e])
          }
          return {
            appliedChanges: guideChangesBeforeRestore,
            errors: brandDeployResults.errors,
          }
        })
        .toArray()
    } catch (e) {
      if (!isSaltoError(e)) {
        throw e
      }
      return [
        {
          appliedChanges: [],
          errors: [e],
        },
      ]
    }
  }

  /**
   * Deploy configuration elements to the given account.
   */
  @logDuration('deploying account configuration')
  async deploy({ changeGroup }: DeployOptions): Promise<DeployResult> {
    const [instanceChanges, nonInstanceChanges] = _.partition(changeGroup.changes, isInstanceChange)
    if (nonInstanceChanges.length > 0) {
      log.warn(
        `We currently can't deploy types. Therefore, the following changes will not be deployed: ${nonInstanceChanges.map(elem => getChangeData(elem).elemID.getFullName()).join(', ')}`,
      )
    }
    const changesToDeploy = instanceChanges.map(change => ({
      action: change.action,
      data: _.mapValues(change.data, (instance: InstanceElement) =>
        replaceInstanceTypeForDeploy({
          instance,
          config: this.userConfig[API_DEFINITIONS_CONFIG],
        }),
      ),
    })) as Change<InstanceElement>[]
    const sourceChanges = _.keyBy(changesToDeploy, change => getChangeData(change).elemID.getFullName())
    const runner = await this.createFiltersRunner({})
    const resolvedChanges = await awu(changesToDeploy)
      .map(async change =>
        SKIP_RESOLVE_TYPE_NAMES.includes(getChangeData(change).elemID.typeName)
          ? change
          : resolveChangeElement(change, lookupFunc, resolveValues, this.elementsSource),
      )
      .toArray()
    const [guideResolvedChanges, supportResolvedChanges] = _.partition(resolvedChanges, change =>
      GUIDE_TYPES_TO_HANDLE_BY_BRAND.includes(getChangeData(change).elemID.typeName),
    )
    const saltoErrors: SaltoError[] = []
    try {
      await runner.preDeploy(supportResolvedChanges)
    } catch (e) {
      if (!isSaltoError(e)) {
        throw e
      }
      return {
        appliedChanges: [],
        errors: [e],
      }
    }
    const { deployResult } = await runner.deploy(supportResolvedChanges, changeGroup)
    const appliedChangesBeforeRestore = [...deployResult.appliedChanges]
    try {
      await runner.onDeploy(appliedChangesBeforeRestore)
    } catch (e) {
      if (!isSaltoError(e)) {
        throw e
      }
      saltoErrors.push(e)
    }

    const guideDeployResults = await this.deployGuideChanges(guideResolvedChanges, changeGroup)
    const allChangesBeforeRestore = appliedChangesBeforeRestore.concat(
      guideDeployResults.flatMap(result => result.appliedChanges),
    )
    const appliedChanges = await awu(allChangesBeforeRestore)
      .map(change => restoreChangeElement(change, sourceChanges, lookupFunc))
      .toArray()
    const restoredAppliedChanges = restoreInstanceTypeFromDeploy({
      appliedChanges,
      originalInstanceChanges: instanceChanges,
    })
    return {
      appliedChanges: restoredAppliedChanges,
      errors: deployResult.errors.concat(guideDeployResults.flatMap(result => result.errors)).concat(saltoErrors),
    }
  }

  public get deployModifiers(): DeployModifiers {
    return {
      changeValidator: createChangeValidator({
        client: this.client,
        config: this.userConfig,
        definitions: this.adapterDefinitions,
        oldApiDefsConfig: this.userConfig[API_DEFINITIONS_CONFIG],
        fetchConfig: this.userConfig[FETCH_CONFIG],
        deployConfig: this.userConfig[DEPLOY_CONFIG],
        typesDeployedViaParent: [
          'organization_field__custom_field_options',
          'macro_attachment',
          BRAND_LOGO_TYPE_NAME,
          CUSTOM_OBJECT_FIELD_OPTIONS_TYPE_NAME,
        ],
        // article_attachment, guide themes additions, and locales are supported in a filter
        typesWithNoDeploy: [
          'tag',
          ARTICLE_ATTACHMENT_TYPE_NAME,
          GUIDE_THEME_TYPE_NAME,
          THEME_SETTINGS_TYPE_NAME,
          ...GUIDE_ORDER_TYPES,
          DEFAULT_CUSTOM_STATUSES_TYPE_NAME,
          CUSTOM_OBJECT_FIELD_ORDER_TYPE_NAME,
          LOCALE_TYPE_NAME,
        ],
      }),
      dependencyChanger,
      getChangeGroupIds,
    }
  }

  fixElements: FixElementsFunc = elements => this.fixElementsFunc(elements)
}
