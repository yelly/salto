/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { ElemID, CORE_ANNOTATIONS, BuiltinTypes, ListType, MapType } from '@salto-io/adapter-api'
import { createMatchingObjectType } from '@salto-io/adapter-utils'
import { client as clientUtils, config as configUtils, definitions, elements } from '@salto-io/adapter-components'
import {
  ARTICLE_ATTACHMENT_TYPE_NAME,
  ARTICLE_ORDER_TYPE_NAME,
  CONVERSATION_BOT,
  BRAND_TYPE_NAME,
  CATEGORY_ORDER_TYPE_NAME,
  EVERYONE_USER_TYPE,
  SECTION_ORDER_TYPE_NAME,
  THEME_SETTINGS_TYPE_NAME,
  ZENDESK,
  BOT_BUILDER_ANSWER,
  BOT_BUILDER_NODE,
} from './constants'
import {
  fixerNames,
  Guide,
  IdLocator,
  OmitInactiveConfig,
  Themes,
  ZendeskApiConfig,
  ZendeskClientConfig,
  ZendeskDeployConfig,
  ZendeskFetchConfig,
  ZendeskFixElementsConfig,
} from './user_config'

const { defaultMissingUserFallbackField } = configUtils
const { createClientConfigType } = definitions
const { createDucktypeAdapterApiConfigType, validateDuckTypeFetchConfig, validateDefaultWithCustomizations } =
  configUtils

export const DEFAULT_ID_FIELDS = ['name']
export const DEFAULT_FILENAME_FIELDS = ['name']
export const DEFAULT_SERVICE_ID_FIELD = 'id'
export const FIELDS_TO_OMIT: configUtils.FieldToOmitType[] = [
  { fieldName: 'extended_input_schema' },
  { fieldName: 'extended_output_schema' },
  { fieldName: 'url', fieldType: 'string' },
  { fieldName: 'count', fieldType: 'number' },
]
export const FIELDS_TO_HIDE: configUtils.FieldToHideType[] = [
  { fieldName: 'created_at' },
  { fieldName: 'updated_at' },
  { fieldName: 'created_by_id' },
  { fieldName: 'updated_by_id' },
]
export const PAGE_SIZE = 100
export const DEFAULT_QUERY_PARAMS = {
  'page[size]': String(PAGE_SIZE),
}
export const CURSOR_BASED_PAGINATION_FIELD = 'links.next'

export const CLIENT_CONFIG = 'client'
export const FETCH_CONFIG = 'fetch'
export const DEPLOY_CONFIG = 'deploy'
export const FIX_ELEMENTS_CONFIG = 'fixElements'

export const API_DEFINITIONS_CONFIG = 'apiDefinitions'

const DEFAULT_REQUEST_TIMEOUT = 10000 // Roughly p98 of observed request times

export const DEFAULT_TIMEOUT_OPTS = {
  ...clientUtils.DEFAULT_TIMEOUT_OPTS,
  maxDuration: DEFAULT_REQUEST_TIMEOUT,
}

export const OMIT_INACTIVE_DEFAULT = true

export type ZendeskConfig = {
  [CLIENT_CONFIG]?: ZendeskClientConfig
  [FETCH_CONFIG]: ZendeskFetchConfig
  [DEPLOY_CONFIG]?: ZendeskDeployConfig
  [API_DEFINITIONS_CONFIG]: ZendeskApiConfig
  [FIX_ELEMENTS_CONFIG]?: ZendeskFixElementsConfig
}

export const DEFAULT_TYPES: ZendeskApiConfig['types'] = {
  // types that should exist in workspace
  group: {
    transformation: {
      sourceTypeName: 'groups__groups',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      serviceUrl: '/admin/people/team/groups',
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
    deployRequests: {
      add: {
        url: '/api/v2/groups',
        deployAsField: 'group',
        method: 'post',
      },
      modify: {
        url: '/api/v2/groups/{groupId}',
        method: 'put',
        deployAsField: 'group',
        urlParamsToFields: {
          groupId: 'id',
        },
      },
      remove: {
        url: '/api/v2/groups/{groupId}',
        method: 'delete',
        urlParamsToFields: {
          groupId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  custom_role: {
    transformation: {
      sourceTypeName: 'custom_roles__custom_roles',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldsToOmit: FIELDS_TO_OMIT.concat([
        // always 0 - https://developer.zendesk.com/api-reference/ticketing/account-configuration/custom_roles/#json-format
        { fieldName: 'role_type', fieldType: 'number' },
        { fieldName: 'team_member_count', fieldType: 'number' },
      ]),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/people/team/roles/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/custom_roles',
        deployAsField: 'custom_role',
        method: 'post',
      },
      modify: {
        url: '/api/v2/custom_roles/{customRoleId}',
        method: 'put',
        deployAsField: 'custom_role',
        urlParamsToFields: {
          customRoleId: 'id',
        },
      },
      remove: {
        url: '/api/v2/custom_roles/{customRoleId}',
        method: 'delete',
        urlParamsToFields: {
          customRoleId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  [CONVERSATION_BOT]: {
    transformation: {
      // This is added as the deprecated filter for references (referencedInstanceNamesFilterCreatorDeprecated) looks only in this config for the referenced idFields
      idFields: ['&brandId', 'name'],
    },
  },
  [BOT_BUILDER_ANSWER]: {
    transformation: {
      idFields: ['name'],
      extendsParentId: true,
    },
  },
  [BOT_BUILDER_NODE]: {
    transformation: {
      idFields: ['id'],
      extendsParentId: true,
    },
  },
  organization: {
    transformation: {
      sourceTypeName: 'organizations__organizations',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [
        { fieldName: 'organization_fields', fieldType: 'map<unknown>' },
        { fieldName: 'id', fieldType: 'number' },
      ],
      serviceUrl: '/agent/organizations/{id}/tickets',
    },
    deployRequests: {
      add: {
        url: '/api/v2/organizations',
        deployAsField: 'organization',
        method: 'post',
      },
      modify: {
        url: '/api/v2/organizations/{organizationId}',
        method: 'put',
        deployAsField: 'organization',
        urlParamsToFields: {
          organizationId: 'id',
        },
      },
      remove: {
        url: '/api/v2/organizations/{organizationId}',
        method: 'delete',
        urlParamsToFields: {
          organizationId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  view: {
    transformation: {
      sourceTypeName: 'views__views',
      idFields: ['title'],
      fileNameFields: ['title'],
      fieldsToHide: FIELDS_TO_HIDE.concat([
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'title', fieldType: 'string' },
      ]),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/workspaces/agent-workspace/views/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/views',
        deployAsField: 'view',
        method: 'post',
      },
      modify: {
        url: '/api/v2/views/{viewId}',
        method: 'put',
        deployAsField: 'view',
        urlParamsToFields: {
          viewId: 'id',
        },
      },
      remove: {
        url: '/api/v2/views/{viewId}',
        method: 'delete',
        urlParamsToFields: {
          viewId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  view_order: {
    deployRequests: {
      modify: {
        url: '/api/v2/views/update_many',
        method: 'put',
      },
    },
  },
  view__restriction: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'unknown' },
        {
          fieldName: 'type',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['Group', 'User'] },
        },
      ],
    },
  },
  trigger: {
    transformation: {
      sourceTypeName: 'triggers__triggers',
      idFields: ['title'],
      fileNameFields: ['title'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/rules/triggers/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/triggers',
        deployAsField: 'trigger',
        method: 'post',
      },
      modify: {
        url: '/api/v2/triggers/{triggerId}',
        method: 'put',
        deployAsField: 'trigger',
        urlParamsToFields: {
          triggerId: 'id',
        },
      },
      remove: {
        url: '/api/v2/triggers/{triggerId}',
        method: 'delete',
        urlParamsToFields: {
          triggerId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  trigger__conditions__all: {
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'is_user_value', fieldType: 'boolean' }],
    },
  },
  trigger__conditions__any: {
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'is_user_value', fieldType: 'boolean' }],
    },
  },
  trigger_category: {
    transformation: {
      sourceTypeName: 'trigger_categories__trigger_categories',
      fileNameFields: ['name'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id' }),
      serviceUrl: '/admin/objects-rules/rules/triggers',
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'string' }],
    },
    deployRequests: {
      add: {
        url: '/api/v2/trigger_categories',
        deployAsField: 'trigger_category',
        method: 'post',
      },
      modify: {
        url: '/api/v2/trigger_categories/{triggerCategoryId}',
        method: 'patch',
        deployAsField: 'trigger_category',
        urlParamsToFields: {
          triggerCategoryId: 'id',
        },
      },
      remove: {
        url: '/api/v2/trigger_categories/{triggerCategoryId}',
        method: 'delete',
        urlParamsToFields: {
          triggerCategoryId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  trigger_order: {
    deployRequests: {
      modify: {
        url: '/api/v2/trigger_categories/jobs',
        method: 'post',
        deployAsField: 'job',
      },
    },
  },
  trigger_order_entry: {
    transformation: {
      sourceTypeName: 'trigger_order__order',
    },
  },
  automation: {
    transformation: {
      sourceTypeName: 'automations__automations',
      idFields: ['title'],
      fileNameFields: ['title'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/rules/automations/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/automations',
        deployAsField: 'automation',
        method: 'post',
      },
      modify: {
        url: '/api/v2/automations/{automationId}',
        method: 'put',
        deployAsField: 'automation',
        urlParamsToFields: {
          automationId: 'id',
        },
      },
      remove: {
        url: '/api/v2/automations/{automationId}',
        method: 'delete',
        urlParamsToFields: {
          automationId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  automation_order: {
    deployRequests: {
      modify: {
        url: '/api/v2/automations/update_many',
        method: 'put',
      },
    },
  },
  sla_policy: {
    transformation: {
      sourceTypeName: 'sla_policies__sla_policies',
      idFields: ['title'],
      fileNameFields: ['title'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/rules/slas',
    },
    deployRequests: {
      add: {
        url: '/api/v2/slas/policies',
        deployAsField: 'sla_policy',
        method: 'post',
      },
      modify: {
        url: '/api/v2/slas/policies/{slaPolicyId}',
        method: 'put',
        deployAsField: 'sla_policy',
        urlParamsToFields: {
          slaPolicyId: 'id',
        },
      },
      remove: {
        url: '/api/v2/slas/policies/{slaPolicyId}',
        method: 'delete',
        urlParamsToFields: {
          slaPolicyId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  sla_policy__filter__all: {
    transformation: {
      // value can be number or string
      fieldTypeOverrides: [{ fieldName: 'value', fieldType: 'unknown' }],
    },
  },
  sla_policy__filter__any: {
    transformation: {
      // value can be number or string
      fieldTypeOverrides: [{ fieldName: 'value', fieldType: 'unknown' }],
    },
  },
  sla_policy_order: {
    deployRequests: {
      modify: {
        url: '/api/v2/slas/policies/reorder',
        method: 'put',
      },
    },
  },
  sla_policy_definition: {
    transformation: {
      sourceTypeName: 'sla_policies_definitions__definitions',
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  target: {
    transformation: {
      sourceTypeName: 'targets__targets',
      idFields: ['title', 'type'], // looks like title is unique so not adding id
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/apps-integrations/targets/targets',
    },
    deployRequests: {
      add: {
        url: '/api/v2/targets',
        deployAsField: 'target',
        method: 'post',
      },
      modify: {
        url: '/api/v2/targets/{targetId}',
        method: 'put',
        deployAsField: 'target',
        urlParamsToFields: {
          targetId: 'id',
        },
      },
      remove: {
        url: '/api/v2/targets/{targetId}',
        method: 'delete',
        urlParamsToFields: {
          targetId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  macro: {
    transformation: {
      sourceTypeName: 'macros__macros',
      idFields: ['title'],
      fileNameFields: ['title'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'position', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/workspaces/agent-workspace/macros/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/macros',
        deployAsField: 'macro',
        method: 'post',
      },
      modify: {
        url: '/api/v2/macros/{macroId}',
        method: 'put',
        deployAsField: 'macro',
        urlParamsToFields: {
          macroId: 'id',
        },
      },
      remove: {
        url: '/api/v2/macros/{macroId}',
        method: 'delete',
        urlParamsToFields: {
          macroId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  macro_attachment: {
    transformation: {
      idFields: ['filename'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },
  macro_action: {
    transformation: {
      sourceTypeName: 'macros_actions__actions',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  macro_category: {
    transformation: {
      sourceTypeName: 'macros_categories__categories',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  macro_definition: {
    transformation: {
      sourceTypeName: 'macros_definitions__definitions',
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  [BRAND_TYPE_NAME]: {
    transformation: {
      sourceTypeName: 'brands__brands',
      // We currently not supporting in attachements
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'ticket_form_ids' }),
      fieldTypeOverrides: [
        {
          fieldName: 'help_center_state',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['enabled', 'disabled', 'restricted'] },
        },
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'categories', fieldType: 'list<category>' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      serviceUrl: '/admin/account/brand_management/brands',
    },
    deployRequests: {
      add: {
        url: '/api/v2/brands',
        deployAsField: 'brand',
        method: 'post',
      },
      modify: {
        url: '/api/v2/brands/{brandId}',
        method: 'put',
        deployAsField: 'brand',
        urlParamsToFields: {
          brandId: 'id',
        },
      },
      remove: {
        url: '/api/v2/brands/{brandId}',
        method: 'delete',
        urlParamsToFields: {
          brandId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  locale: {
    transformation: {
      sourceTypeName: 'locales__locales',
      idFields: ['locale'],
      fileNameFields: ['locale'],
      // no need to hide id as consistent across envs
      fieldsToHide: FIELDS_TO_HIDE.concat([{ fieldName: 'default', fieldType: 'boolean' }]),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },
  business_hours_schedules: {
    request: {
      url: '/api/v2/business_hours/schedules',
      recurseInto: [
        {
          type: 'business_hours_schedule__holiday',
          toField: 'holidays',
          context: [{ name: 'scheduleId', fromField: 'id' }],
        },
      ],
    },
    transformation: {
      dataField: 'schedules',
    },
  },
  business_hours_schedule: {
    transformation: {
      standaloneFields: [{ fieldName: 'holidays' }],
      sourceTypeName: 'business_hours_schedules__schedules',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/rules/schedules',
    },
    deployRequests: {
      add: {
        url: '/api/v2/business_hours/schedules',
        deployAsField: 'schedule',
        method: 'post',
      },
      modify: {
        url: '/api/v2/business_hours/schedules/{scheduleId}',
        method: 'put',
        deployAsField: 'schedule',
        urlParamsToFields: {
          scheduleId: 'id',
        },
      },
      remove: {
        url: '/api/v2/business_hours/schedules/{scheduleId}',
        method: 'delete',
        urlParamsToFields: {
          scheduleId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  sharing_agreement: {
    transformation: {
      sourceTypeName: 'sharing_agreements__sharing_agreements',
      fieldTypeOverrides: [
        {
          fieldName: 'status',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['accepted', 'declined', 'pending', 'inactive'] },
        },
        {
          fieldName: 'type',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['inbound', 'outbound'] },
        },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
    deployRequests: {
      add: {
        url: '/api/v2/sharing_agreements',
        deployAsField: 'sharing_agreement',
        method: 'post',
      },
      modify: {
        url: '/api/v2/sharing_agreements/{sharingAgreementId}',
        method: 'put',
        deployAsField: 'sharing_agreement',
        urlParamsToFields: {
          sharingAgreementId: 'id',
        },
      },
      remove: {
        url: '/api/v2/sharing_agreements/{sharingAgreementId}',
        method: 'delete',
        urlParamsToFields: {
          sharingAgreementId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  support_address: {
    transformation: {
      sourceTypeName: 'support_addresses__recipient_addresses',
      idFields: ['name', '&email'],
      fieldTypeOverrides: [
        {
          fieldName: 'cname_status',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['unknown', 'verified', 'failed'] },
        },
        {
          fieldName: 'username',
          fieldType: 'string',
        },
        {
          fieldName: 'dns_results',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['verified', 'failed'] },
        },
        {
          fieldName: 'domain_verification_status',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['unknown', 'verified', 'failed'] },
        },
        {
          fieldName: 'forwarding_status',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['unknown', 'waiting', 'verified', 'failed'] },
        },
        {
          fieldName: 'spf_status',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['unknown', 'verified', 'failed'] },
        },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat([
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'domain_verification_code' },
        { fieldName: 'username', fieldType: 'string' },
      ]),
    },
    deployRequests: {
      add: {
        url: '/api/v2/recipient_addresses',
        deployAsField: 'recipient_address',
        method: 'post',
      },
      modify: {
        url: '/api/v2/recipient_addresses/{supportAddressId}',
        method: 'put',
        deployAsField: 'recipient_address',
        urlParamsToFields: {
          supportAddressId: 'id',
        },
      },
      remove: {
        url: '/api/v2/recipient_addresses/{supportAddressId}',
        method: 'delete',
        urlParamsToFields: {
          supportAddressId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  ticket_form: {
    transformation: {
      sourceTypeName: 'ticket_forms__ticket_forms',
      fieldsToHide: FIELDS_TO_HIDE.concat([
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'name', fieldType: 'string' },
      ]),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'display_name', fieldType: 'string' }),
      serviceUrl: '/admin/objects-rules/tickets/ticket-forms/edit/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/ticket_forms',
        deployAsField: 'ticket_form',
        method: 'post',
      },
      modify: {
        url: '/api/v2/ticket_forms/{ticketFormId}',
        method: 'put',
        deployAsField: 'ticket_form',
        urlParamsToFields: {
          ticketFormId: 'id',
        },
      },
      remove: {
        url: '/api/v2/ticket_forms/{ticketFormId}',
        method: 'delete',
        urlParamsToFields: {
          ticketFormId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  custom_statuses: {
    request: {
      url: '/api/v2/custom_statuses',
    },
    transformation: {
      dataField: 'custom_statuses',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  custom_status: {
    transformation: {
      sourceTypeName: 'custom_statuses__custom_statuses',
      idFields: ['status_category', 'raw_agent_label'],
      fileNameFields: ['status_category', 'raw_agent_label'],
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'end_user_label', fieldType: 'string' },
        { fieldName: 'agent_label', fieldType: 'string' },
        { fieldName: 'description', fieldType: 'string' },
        { fieldName: 'end_user_description', fieldType: 'string' },
        { fieldName: 'default', fieldType: 'boolean' },
      ),
      fieldsToOmit: FIELDS_TO_OMIT,
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/tickets/ticket_statuses/edit/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/custom_statuses',
        deployAsField: 'custom_status',
        method: 'post',
      },
      modify: {
        url: '/api/v2/custom_statuses/{custom_status_id}',
        method: 'put',
        deployAsField: 'custom_status',
        urlParamsToFields: {
          custom_status_id: 'id',
        },
      },
    },
  },
  ticket_field: {
    transformation: {
      sourceTypeName: 'ticket_fields__ticket_fields',
      idFields: ['raw_title', 'type'],
      fileNameFields: ['raw_title', 'type'],
      standaloneFields: [{ fieldName: 'custom_field_options' }],
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'title', fieldType: 'string' },
      ),
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'position', fieldType: 'number' },
        { fieldName: 'description', fieldType: 'string' },
        { fieldName: 'title_in_portal', fieldType: 'string' },
        // TODO may want to add back as part of SALTO-2895
        { fieldName: 'custom_statuses' },
      ),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/objects-rules/tickets/ticket-fields/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/ticket_fields',
        deployAsField: 'ticket_field',
        method: 'post',
      },
      modify: {
        url: '/api/v2/ticket_fields/{ticketFieldId}',
        method: 'put',
        deployAsField: 'ticket_field',
        urlParamsToFields: {
          ticketFieldId: 'id',
        },
      },
      remove: {
        url: '/api/v2/ticket_fields/{ticketFieldId}',
        method: 'delete',
        urlParamsToFields: {
          ticketFieldId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  ticket_field__custom_field_options: {
    deployRequests: {
      add: {
        url: '/api/v2/ticket_fields/{ticketFieldId}/options',
        method: 'post',
        deployAsField: 'custom_field_option',
        urlParamsToFields: {
          ticketFieldId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/ticket_fields/{ticketFieldId}/options',
        method: 'post',
        deployAsField: 'custom_field_option',
        urlParamsToFields: {
          ticketFieldId: '_parent.0.id',
        },
      },
      remove: {
        url: '/api/v2/ticket_fields/{ticketFieldId}/options/{ticketFieldOptionId}',
        method: 'delete',
        urlParamsToFields: {
          ticketFieldId: '_parent.0.id',
          ticketFieldOptionId: 'id',
        },
        omitRequestBody: true,
      },
    },
    transformation: {
      idFields: ['value'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'name', fieldType: 'string' }),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        {
          fieldName: 'value',
          fieldType: 'string',
          restrictions: {
            enforce_value: true,
            // this regex will not allow the following characters to be in the string:
            // & % $ # @ ! { } [ ] = + ( ) * ? < > , " ' ` ; \
            regex: '^[^&%$#@\\! \\{\\}\\[\\]=\\+\\(\\)\\*\\?<>,"\'`;\\\\]+$',
          },
        },
      ],
    },
  },
  user_field: {
    transformation: {
      sourceTypeName: 'user_fields__user_fields',
      idFields: ['key'],
      standaloneFields: [{ fieldName: 'custom_field_options' }],
      fieldTypeOverrides: [
        {
          fieldName: 'type',
          fieldType: 'string',
        },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'title', fieldType: 'string' },
      ),
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'description', fieldType: 'string' }),
      serviceUrl: '/agent/admin/user_fields/{id}',
      nameMapping: 'lowercase',
    },
    deployRequests: {
      add: {
        url: '/api/v2/user_fields',
        deployAsField: 'user_field',
        method: 'post',
      },
      modify: {
        url: '/api/v2/user_fields/{userFieldId}',
        method: 'put',
        deployAsField: 'user_field',
        urlParamsToFields: {
          userFieldId: 'id',
        },
      },
      remove: {
        url: '/api/v2/user_fields/{userFieldId}',
        method: 'delete',
        urlParamsToFields: {
          userFieldId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  user_field__custom_field_options: {
    deployRequests: {
      add: {
        url: '/api/v2/user_fields/{userFieldId}/options',
        method: 'post',
        deployAsField: 'custom_field_option',
        urlParamsToFields: {
          userFieldId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/user_fields/{userFieldId}/options',
        method: 'post',
        deployAsField: 'custom_field_option',
        urlParamsToFields: {
          userFieldId: '_parent.0.id',
        },
      },
      remove: {
        url: '/api/v2/user_fields/{userFieldId}/options/{userFieldOptionId}',
        method: 'delete',
        urlParamsToFields: {
          userFieldId: '_parent.0.id',
          userFieldOptionId: 'id',
        },
        omitRequestBody: true,
      },
    },
    transformation: {
      idFields: ['value'],
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'default', fieldType: 'boolean' },
      ),
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'name', fieldType: 'string' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },
  user_field_order: {
    deployRequests: {
      modify: {
        url: '/api/v2/user_fields/reorder',
        method: 'put',
      },
    },
  },
  organization_field: {
    transformation: {
      sourceTypeName: 'organization_fields__organization_fields',
      idFields: ['key'],
      standaloneFields: [{ fieldName: 'custom_field_options' }],
      fieldTypeOverrides: [
        {
          fieldName: 'type',
          fieldType: 'string',
        },
        { fieldName: 'id', fieldType: 'number' },
      ],
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'title', fieldType: 'string' },
      ),
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'description', fieldType: 'string' }),
      serviceUrl: '/agent/admin/organization_fields/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/organization_fields',
        deployAsField: 'organization_field',
        method: 'post',
      },
      modify: {
        url: '/api/v2/organization_fields/{organizationFieldId}',
        method: 'put',
        deployAsField: 'organization_field',
        urlParamsToFields: {
          organizationFieldId: 'id',
        },
      },
      remove: {
        url: '/api/v2/organization_fields/{organizationFieldId}',
        method: 'delete',
        urlParamsToFields: {
          organizationFieldId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  organization_field__custom_field_options: {
    transformation: {
      idFields: ['value'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'name', fieldType: 'string' }),
    },
  },
  organization_field_order: {
    transformation: {
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
    deployRequests: {
      modify: {
        url: '/api/v2/organization_fields/reorder',
        method: 'put',
      },
    },
  },
  routing_attribute: {
    transformation: {
      standaloneFields: [{ fieldName: 'values' }],
      sourceTypeName: 'routing_attributes__attributes',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'string' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'string' }],
      serviceUrl: '/admin/objects-rules/rules/routing',
    },
    deployRequests: {
      add: {
        url: '/api/v2/routing/attributes',
        deployAsField: 'attribute',
        method: 'post',
      },
      modify: {
        url: '/api/v2/routing/attributes/{attributeId}',
        method: 'put',
        deployAsField: 'attribute',
        urlParamsToFields: {
          attributeId: 'id',
        },
      },
      remove: {
        url: '/api/v2/routing/attributes/{attributeId}',
        method: 'delete',
        urlParamsToFields: {
          attributeId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  routing_attribute_definition: {
    transformation: {
      sourceTypeName: 'routing_attribute_definitions__definitions',
      hasDynamicFields: true,
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  workspace: {
    transformation: {
      sourceTypeName: 'workspaces__workspaces',
      idFields: ['title'],
      fileNameFields: ['title'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/workspaces/agent-workspace/contextual-workspaces',
    },
    deployRequests: {
      add: {
        url: '/api/v2/workspaces',
        deployAsField: 'workspace',
        method: 'post',
      },
      modify: {
        url: '/api/v2/workspaces/{workspaceId}',
        method: 'put',
        deployAsField: 'workspace',
        urlParamsToFields: {
          workspaceId: 'id',
        },
      },
      remove: {
        url: '/api/v2/workspaces/{workspaceId}',
        method: 'delete',
        urlParamsToFields: {
          workspaceId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  workspace__selected_macros: {
    transformation: {
      fieldsToHide: [],
      fieldsToOmit: [{ fieldName: 'usage_7d', fieldType: 'number' }],
    },
  },
  workspace__selected_macros__restriction: {
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'unknown' }],
    },
  },
  workspace__apps: {
    transformation: {
      fieldsToHide: [],
    },
  },
  workspace_order: {
    deployRequests: {
      modify: {
        url: '/api/v2/workspaces/reorder',
        method: 'put',
      },
    },
  },
  layout: {
    deployRequests: {
      add: {
        url: '/api/v2/layouts',
        method: 'post',
      },
      modify: {
        url: '/api/v2/layouts/{layoutId}',
        method: 'put',
        urlParamsToFields: {
          layoutId: 'id',
        },
      },
      remove: {
        url: '/api/v2/layouts/{layoutId}',
        method: 'delete',
        urlParamsToFields: {
          layoutId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  queue: {
    transformation: {
      serviceUrl: '/admin/objects-rules/omnichannel-routing/queues/edit/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/queues',
        deployAsField: 'queue',
        method: 'post',
      },
      modify: {
        url: '/api/v2/queues/{queueId}',
        deployAsField: 'queue',
        method: 'put',
        urlParamsToFields: {
          queueId: 'id',
        },
      },
      remove: {
        url: '/api/v2/queues/{queueId}',
        method: 'delete',
        urlParamsToFields: {
          queueId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  queue_order: {
    deployRequests: {
      modify: {
        url: 'api/v2/queues/order',
        method: 'patch',
      },
    },
  },
  app_installation: {
    transformation: {
      sourceTypeName: 'app_installations__installations',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'updated', fieldType: 'string' }),
      idFields: ['settings.name', 'product'],
      fileNameFields: ['settings.name', 'product'],
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/apps-integrations/apps/support-apps',
    },
    deployRequests: {
      add: {
        url: '/api/v2/apps/installations',
        method: 'post',
      },
      modify: {
        url: '/api/v2/apps/installations/{appInstallationId}',
        method: 'put',
        urlParamsToFields: {
          appInstallationId: 'id',
        },
      },
      remove: {
        url: '/api/v2/apps/installations/{appInstallationId}',
        method: 'delete',
        urlParamsToFields: {
          appInstallationId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  app_owned: {
    transformation: {
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'parameters', fieldType: 'map<app_owned__parameters>' },
      ],
      sourceTypeName: 'apps_owned__apps',
    },
  },
  app_owned__parameters: {
    transformation: {
      fieldsToHide: FIELDS_TO_HIDE.concat([{ fieldName: 'id' }, { fieldName: 'app_id' }]),
      fieldsToOmit: [],
    },
  },
  oauth_client: {
    transformation: {
      sourceTypeName: 'oauth_clients__clients',
      idFields: ['identifier'],
      fieldsToHide: FIELDS_TO_HIDE.concat([
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'secret', fieldType: 'string' },
        { fieldName: 'user_id', fieldType: 'number' },
      ]),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'secret', fieldType: 'string' },
        { fieldName: 'user_id', fieldType: 'number' },
      ],
      serviceUrl: '/admin/apps-integrations/apis/zendesk-api/oauth_clients',
    },
    deployRequests: {
      add: {
        url: '/api/v2/oauth/clients',
        deployAsField: 'client',
        method: 'post',
      },
      modify: {
        url: '/api/v2/oauth/clients/{oauthClientId}',
        method: 'put',
        deployAsField: 'client',
        urlParamsToFields: {
          oauthClientId: 'id',
        },
      },
      remove: {
        url: '/api/v2/oauth/clients/{oauthClientId}',
        method: 'delete',
        urlParamsToFields: {
          oauthClientId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  oauth_global_client: {
    transformation: {
      sourceTypeName: 'oauth_global_clients__global_clients',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },
  account_setting: {
    transformation: {
      sourceTypeName: 'account_settings__settings',
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
    deployRequests: {
      modify: {
        url: '/api/v2/account/settings',
        method: 'put',
        deployAsField: 'settings',
      },
    },
  },
  account_setting__localization: {
    transformation: {
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'locale_ids' }),
    },
  },
  resource_collection: {
    transformation: {
      sourceTypeName: 'resource_collections__resource_collections',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },
  monitored_twitter_handle: {
    transformation: {
      sourceTypeName: 'monitored_twitter_handles__monitored_twitter_handles',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
  },

  // placeholder for config validation (the type is created by a filter)
  tag: {
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'string' }],
    },
  },

  // api types
  groups: {
    request: {
      url: '/api/v2/groups',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'groups',
    },
  },
  custom_roles: {
    request: {
      url: '/api/v2/custom_roles',
    },
    transformation: {
      dataField: 'custom_roles',
    },
  },
  organizations: {
    request: {
      url: '/api/v2/organizations',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'organizations',
    },
  },
  views: {
    request: {
      url: '/api/v2/views',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'views',
      fileNameFields: ['title'],
    },
  },
  triggers: {
    request: {
      url: '/api/v2/triggers',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'triggers',
    },
  },
  trigger_definitions: {
    request: {
      url: '/api/v2/triggers/definitions',
    },
    transformation: {
      dataField: 'definitions',
    },
  },
  trigger_definition: {
    transformation: {
      sourceTypeName: 'trigger_definitions__definitions',
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  trigger_categories: {
    request: {
      url: '/api/v2/trigger_categories',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'trigger_categories',
    },
  },
  automations: {
    request: {
      url: '/api/v2/automations',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'automations',
    },
  },
  sla_policies: {
    request: {
      url: '/api/v2/slas/policies',
    },
  },
  sla_policies_definitions: {
    request: {
      url: '/api/v2/slas/policies/definitions',
    },
    transformation: {
      dataField: 'value',
    },
  },
  targets: {
    request: {
      url: '/api/v2/targets',
    },
  },
  macros: {
    request: {
      url: '/api/v2/macros',
      queryParams: {
        ...DEFAULT_QUERY_PARAMS,
        access: 'shared',
      },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'macros',
    },
  },
  macros_actions: {
    request: {
      url: '/api/v2/macros/actions',
    },
    transformation: {
      // no unique identifier for individual items
      dataField: '.',
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  macro_categories: {
    request: {
      url: '/api/v2/macros/categories',
    },
    transformation: {
      isSingleton: true,
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  macros_definitions: {
    // has some overlaps with macro_actions
    request: {
      url: '/api/v2/macros/definitions',
    },
    transformation: {
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  macro__restriction: {
    transformation: {
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'unknown' }],
    },
  },
  brands: {
    request: {
      url: '/api/v2/brands',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'brands',
    },
  },
  dynamic_content_item: {
    request: {
      url: '/api/v2/dynamic_content/items',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: '.',
      standaloneFields: [{ fieldName: 'variants' }],
      fieldsToHide: FIELDS_TO_HIDE.concat([
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'outdated', fieldType: 'boolean' },
      ]),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/admin/workspaces/agent-workspace/dynamic_content',
    },
    deployRequests: {
      add: {
        url: '/api/v2/dynamic_content/items',
        deployAsField: 'item',
        method: 'post',
      },
      modify: {
        url: '/api/v2/dynamic_content/items/{dynamicContentItemId}',
        method: 'put',
        deployAsField: 'item',
        fieldsToIgnore: ['variants'],
        urlParamsToFields: {
          dynamicContentItemId: 'id',
        },
      },
      remove: {
        url: '/api/v2/dynamic_content/items/{dynamicContentItemId}',
        method: 'delete',
        urlParamsToFields: {
          dynamicContentItemId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  dynamic_content_item__variants: {
    transformation: {
      idFields: ['&locale_id'],
      fieldsToHide: FIELDS_TO_HIDE.concat([
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'outdated', fieldType: 'boolean' },
      ]),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      extendsParentId: true,
    },
    deployRequests: {
      add: {
        url: '/api/v2/dynamic_content/items/{dynamicContentItemId}/variants',
        deployAsField: 'variant',
        method: 'post',
        urlParamsToFields: {
          dynamicContentItemId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/dynamic_content/items/{dynamicContentItemId}/variants/{dynammicContentVariantId}',
        deployAsField: 'variant',
        method: 'put',
        urlParamsToFields: {
          dynammicContentVariantId: 'id',
          dynamicContentItemId: '_parent.0.id',
        },
      },
      remove: {
        url: '/api/v2/dynamic_content/items/{dynamicContentItemId}/variants/{dynammicContentVariantId}',
        method: 'delete',
        urlParamsToFields: {
          dynammicContentVariantId: 'id',
          dynamicContentItemId: '_parent.0.id',
        },
        omitRequestBody: true,
      },
    },
  },
  locales: {
    request: {
      url: '/api/v2/locales',
    },
    transformation: {
      dataField: 'locales',
    },
  },
  business_hours_schedule__holiday: {
    request: {
      url: '/api/v2/business_hours/schedules/{scheduleId}/holidays',
    },
    deployRequests: {
      add: {
        url: '/api/v2/business_hours/schedules/{scheduleId}/holidays',
        deployAsField: 'holiday',
        method: 'post',
        urlParamsToFields: {
          scheduleId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/business_hours/schedules/{scheduleId}/holidays/{holidayId}',
        deployAsField: 'holiday',
        method: 'put',
        urlParamsToFields: {
          holidayId: 'id',
          scheduleId: '_parent.0.id',
        },
      },
      remove: {
        url: '/api/v2/business_hours/schedules/{scheduleId}/holidays/{holidayId}',
        method: 'delete',
        urlParamsToFields: {
          holidayId: 'id',
          scheduleId: '_parent.0.id',
        },
        omitRequestBody: true,
      },
    },
    transformation: {
      sourceTypeName: 'business_hours_schedule__holidays',
      extendsParentId: true,
      fieldsToHide: FIELDS_TO_HIDE.concat([
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'start_year', fieldType: 'string' },
        { fieldName: 'end_year', fieldType: 'string' },
      ]),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'start_year', fieldType: 'string' },
        { fieldName: 'end_year', fieldType: 'string' },
      ],
    },
  },
  sharing_agreements: {
    request: {
      url: '/api/v2/sharing_agreements',
    },
  },
  support_addresses: {
    request: {
      url: '/api/v2/recipient_addresses',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      sourceTypeName: 'recipient_addresses',
      dataField: 'recipient_addresses',
    },
  },
  ticket_forms: {
    // not always available
    request: {
      url: '/api/v2/ticket_forms',
    },
    transformation: {
      dataField: 'ticket_forms',
    },
  },
  ticket_form_order: {
    deployRequests: {
      modify: {
        url: '/api/v2/ticket_forms/reorder',
        method: 'put',
      },
    },
  },
  ticket_fields: {
    request: {
      url: '/api/v2/ticket_fields',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'ticket_fields',
      fileNameFields: ['title'],
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  user_fields: {
    request: {
      url: '/api/v2/user_fields',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'user_fields',
    },
  },
  organization_fields: {
    request: {
      url: '/api/v2/organization_fields',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'organization_fields',
    },
  },
  routing_attribute_value: {
    request: {
      url: '/api/v2/routing/attributes/{attributeId}/values',
    },
    deployRequests: {
      add: {
        url: '/api/v2/routing/attributes/{attributeId}/values',
        deployAsField: 'attribute_value',
        method: 'post',
        urlParamsToFields: {
          attributeId: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/routing/attributes/{attributeId}/values/{attributeValueId}',
        deployAsField: 'attribute_value',
        method: 'put',
        urlParamsToFields: {
          attributeValueId: 'id',
          attributeId: '_parent.0.id',
        },
      },
      remove: {
        url: '/api/v2/routing/attributes/{attributeId}/values/{attributeValueId}',
        method: 'delete',
        urlParamsToFields: {
          attributeValueId: 'id',
          attributeId: '_parent.0.id',
        },
        omitRequestBody: true,
      },
    },
    transformation: {
      sourceTypeName: 'routing_attribute__values',
      dataField: 'attribute_values',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'string' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'string' }],
      serviceUrl: '/admin/objects-rules/rules/routing',
    },
  },
  routing_attributes: {
    request: {
      url: '/api/v2/routing/attributes',
      recurseInto: [
        {
          type: 'routing_attribute_value',
          toField: 'values',
          context: [{ name: 'attributeId', fromField: 'id' }],
        },
      ],
    },
  },
  routing_attribute_definitions: {
    request: {
      url: '/api/v2/routing/attributes/definitions',
    },
    transformation: {
      dataField: 'definitions',
    },
  },
  workspaces: {
    // not always available
    request: {
      url: '/api/v2/workspaces',
    },
  },
  app_installations: {
    request: {
      url: '/api/v2/apps/installations',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
  },
  apps_owned: {
    request: {
      url: '/api/v2/apps/owned',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
  },
  oauth_clients: {
    request: {
      url: '/api/v2/oauth/clients',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'clients',
    },
  },
  oauth_global_clients: {
    request: {
      url: '/api/v2/oauth/global_clients',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'global_clients',
    },
  },
  account_settings: {
    request: {
      url: '/api/v2/account/settings',
    },
    transformation: {
      dataField: 'settings',
    },
  },
  resource_collections: {
    request: {
      url: '/api/v2/resource_collections',
      paginationField: 'next_page',
    },
  },
  monitored_twitter_handles: {
    request: {
      url: '/api/v2/channels/twitter/monitored_twitter_handles',
    },
  },
  webhooks: {
    request: {
      url: '/api/v2/webhooks',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'webhooks',
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'meta' }),
    },
  },
  webhook: {
    transformation: {
      sourceTypeName: 'webhooks__webhooks',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'string' },
        { fieldName: 'created_by', fieldType: 'string' },
        { fieldName: 'updated_by', fieldType: 'string' },
      ),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'string' }],
      serviceUrl: '/admin/apps-integrations/webhooks/webhooks/{id}/details',
    },
    deployRequests: {
      add: {
        url: '/api/v2/webhooks',
        deployAsField: 'webhook',
        method: 'post',
      },
      modify: {
        url: '/api/v2/webhooks/{webhookId}',
        method: 'patch',
        deployAsField: 'webhook',
        urlParamsToFields: {
          webhookId: 'id',
        },
      },
      remove: {
        url: '/api/v2/webhooks/{webhookId}',
        method: 'delete',
        urlParamsToFields: {
          webhookId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  articles: {
    request: {
      // we are doing this for better parallelization of requests on large accounts
      // sort_by is added since articles for which the order is alphabetically fail (to avoid future bugs)
      url: '/api/v2/help_center/categories/{category_id}/articles',
      dependsOn: [{ pathParam: 'category_id', from: { type: 'categories', field: 'id' } }],
      queryParams: {
        ...DEFAULT_QUERY_PARAMS,
        include: 'translations',
        sort_by: 'updated_at',
      },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
      recurseInto: [
        {
          type: ARTICLE_ATTACHMENT_TYPE_NAME,
          toField: 'attachments',
          context: [{ name: 'article_id', fromField: 'id' }],
        },
      ],
    },
    transformation: {
      dataField: 'articles',
    },
  },
  article: {
    transformation: {
      idFields: ['title', '&section_id'],
      fileNameFields: ['title', '&section_id'],
      standaloneFields: [{ fieldName: 'translations' }, { fieldName: 'attachments' }],
      sourceTypeName: 'articles__articles',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'position', fieldType: 'number' },
      ),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'author_id', fieldType: 'unknown' },
        { fieldName: 'translations', fieldType: 'list<article_translation>' },
        { fieldName: 'attachments', fieldType: 'list<article_attachment>' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'vote_sum' },
        { fieldName: 'vote_count' },
        { fieldName: 'edited_at' },
        { fieldName: 'name' },
        { fieldName: 'html_url', fieldType: 'string' },
        { fieldName: 'draft', fieldType: 'boolean' },
      ),
      // serviceUrl is created in help_center_service_url filter
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/sections/{sectionId}/articles',
        method: 'post',
        deployAsField: 'article',
        urlParamsToFields: {
          sectionId: 'section_id',
        },
      },
      modify: {
        url: '/api/v2/help_center/articles/{articleId}',
        method: 'put',
        deployAsField: 'article',
        urlParamsToFields: {
          articleId: 'id',
        },
      },
      remove: {
        url: '/api/v2/help_center/articles/{articleId}',
        method: 'delete',
        urlParamsToFields: {
          articleId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  // currently articles do not share attachments, if this changes the attachment code should be reviewed!
  [ARTICLE_ATTACHMENT_TYPE_NAME]: {
    request: {
      url: '/api/v2/help_center/articles/{article_id}/attachments',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      idFields: ['file_name', 'inline'],
      sourceTypeName: 'article__attachments',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'content_url', fieldType: 'string' },
        { fieldName: 'size', fieldType: 'number' },
        { fieldName: 'hash', fieldType: 'string' },
        { fieldName: 'relative_path', fieldType: 'string' },
      ),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'article_attachments', fieldType: 'List<article_attachment>' },
        { fieldName: 'content', fieldType: 'string' },
        { fieldName: 'hash', fieldType: 'string' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'article_id', fieldType: 'number' },
        { fieldName: 'display_file_name', fieldType: 'string' },
      ),
      extendsParentId: true,
      dataField: 'article_attachments',
    },
    deployRequests: {
      remove: {
        url: '/api/v2/help_center/articles/attachments/{articleAttachmentId}',
        method: 'delete',
        urlParamsToFields: {
          articleAttachmentId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  article_translation: {
    transformation: {
      idFields: ['&locale'],
      extendsParentId: true,
      fileNameFields: ['&locale'],
      sourceTypeName: 'article__translations',
      dataField: 'translations',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'brand', fieldType: 'number' },
        { fieldName: 'created_by_id', fieldType: 'unknown' },
        { fieldName: 'updated_by_id', fieldType: 'unknown' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'html_url', fieldType: 'string' },
        { fieldName: 'source_id', fieldType: 'number' },
        { fieldName: 'source_type', fieldType: 'string' },
      ),
      // serviceUrl is created in help_center_service_url filter
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/articles/{article_id}/translations',
        method: 'post',
        deployAsField: 'translation',
        urlParamsToFields: {
          article_id: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/help_center/articles/{article_id}/translations/{locale}',
        method: 'put',
        deployAsField: 'translation',
        urlParamsToFields: {
          article_id: '_parent.0.id',
          locale: 'locale',
        },
      },
      remove: {
        url: '/api/v2/help_center/translations/{translation_id}',
        method: 'delete',
        urlParamsToFields: {
          translation_id: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  guide_language_settings: {
    request: {
      url: '/hc/api/internal/help_center_translations',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      idFields: ['&brand', 'locale'],
      fileNameFields: ['&brand', 'locale'],
      dataField: '.',
      // serviceUrl is created in the help_center_service_url filter
    },
    deployRequests: {
      modify: {
        url: '/hc/api/internal/help_center_translations/{locale}',
        method: 'put',
        urlParamsToFields: {
          locale: 'locale',
        },
      },
      add: {
        url: '/hc/api/internal/help_center_translations',
        method: 'post',
        deployAsField: 'locales',
      },
      remove: {
        url: '/hc/api/internal/help_center_translations/{locale}',
        method: 'delete',
        urlParamsToFields: {
          locale: 'locale',
        },
        omitRequestBody: true,
      },
    },
  },
  guide_settings: {
    request: {
      url: '/hc/api/internal/general_settings',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      idFields: ['&brand'],
      fileNameFields: ['&brand'],
      dataField: '.',
      fieldTypeOverrides: [{ fieldName: 'default_locale', fieldType: 'string' }],
      // serviceUrl is created in the help_center_service_url filter
    },
    deployRequests: {
      modify: {
        url: '/hc/api/internal/general_settings',
        method: 'put',
      },
      // TO DO - check what happens when help center (guide) is created or removed (SALTO-2914)
      // add: {
      //   url: '/hc/api/internal/general_settings',
      //   method: 'post',
      // },
      // remove: {
      //   url: '/hc/api/internal/general_settings',
      //   method: 'delete',
      // },
    },
  },
  guide_settings__help_center: {
    transformation: {
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'feature_restrictions' }, // omited as it does not appear in the http request
      ),
    },
  },
  guide_settings__help_center__settings: {
    transformation: {
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'id' },
        { fieldName: 'account_id', fieldType: 'number' },
        { fieldName: 'help_center_id', fieldType: 'number' },
        { fieldName: 'created_at', fieldType: 'string' },
        { fieldName: 'updated_at', fieldType: 'string' },
        { fieldName: 'draft', fieldType: 'boolean' },
        { fieldName: 'kind', fieldType: 'string' },
      ),
    },
  },
  guide_settings__help_center__text_filter: {
    transformation: {
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'id' },
        { fieldName: 'account_id', fieldType: 'number' },
        { fieldName: 'help_center_id', fieldType: 'number' },
        { fieldName: 'created_at', fieldType: 'string' },
        { fieldName: 'updated_at', fieldType: 'string' },
      ),
    },
  },
  sections: {
    request: {
      url: '/api/v2/help_center/sections',
      queryParams: {
        ...DEFAULT_QUERY_PARAMS,
        include: 'translations',
      },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'sections',
    },
  },
  section: {
    transformation: {
      idFields: [...DEFAULT_ID_FIELDS, '&direct_parent_id'],
      fileNameFields: [...DEFAULT_ID_FIELDS, '&direct_parent_id'],
      standaloneFields: [{ fieldName: 'translations' }],
      sourceTypeName: 'sections__sections',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        // directParent and parentType are created to avoid collisions
        { fieldName: 'direct_parent_id' },
        { fieldName: 'direct_parent_type', fieldType: 'string' },
        { fieldName: 'position', fieldType: 'number' },
      ),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'parent_section_id', fieldType: 'number' },
        { fieldName: 'direct_parent_type', fieldType: 'string' },
        { fieldName: 'sections', fieldType: 'list<section>' },
        { fieldName: 'articles', fieldType: 'list<article>' },
        { fieldName: 'translations', fieldType: 'list<section_translation>' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'html_url', fieldType: 'string' }),
      // serviceUrl is created in help_center_service_url filter
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/categories/{category_id}/sections',
        method: 'post',
        deployAsField: 'section',
        urlParamsToFields: {
          category_id: 'category_id',
        },
      },
      modify: {
        url: '/api/v2/help_center/sections/{section_id}',
        method: 'put',
        deployAsField: 'section',
        urlParamsToFields: {
          section_id: 'id',
        },
      },
      remove: {
        url: '/api/v2/help_center/sections/{section_id}',
        method: 'delete',
        urlParamsToFields: {
          section_id: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  section_order: {
    transformation: {
      idFields: [],
      extendsParentId: true,
    },
  },
  article_order: {
    transformation: {
      idFields: [],
      extendsParentId: true,
    },
  },
  category_order: {
    transformation: {
      idFields: [],
      extendsParentId: true,
    },
  },
  section_translation: {
    transformation: {
      idFields: ['&locale'],
      extendsParentId: true,
      fileNameFields: ['&locale'],
      sourceTypeName: 'section__translations',
      dataField: 'translations',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'brand', fieldType: 'number' },
        { fieldName: 'created_by_id', fieldType: 'unknown' },
        { fieldName: 'updated_by_id', fieldType: 'unknown' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'html_url', fieldType: 'string' },
        { fieldName: 'source_id', fieldType: 'number' },
        { fieldName: 'source_type', fieldType: 'string' },
      ),
      // serviceUrl is created in help_center_service_url filter
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/sections/{section_id}/translations',
        method: 'post',
        deployAsField: 'translation',
        urlParamsToFields: {
          section_id: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/help_center/sections/{section_id}/translations/{locale}',
        method: 'put',
        deployAsField: 'translation',
        urlParamsToFields: {
          section_id: '_parent.0.id',
          locale: 'locale',
        },
      },
      remove: {
        url: '/api/v2/help_center/translations/{translation_id}',
        method: 'delete',
        urlParamsToFields: {
          translation_id: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  categories: {
    request: {
      url: '/api/v2/help_center/categories',
      queryParams: {
        ...DEFAULT_QUERY_PARAMS,
        include: 'translations',
      },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'categories',
    },
  },
  category: {
    transformation: {
      idFields: [...DEFAULT_ID_FIELDS, '&brand'],
      fileNameFields: [...DEFAULT_ID_FIELDS, '&brand'],
      standaloneFields: [{ fieldName: 'translations' }],
      sourceTypeName: 'categories__categories',
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'position', fieldType: 'number' },
      ),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'sections', fieldType: 'list<section>' },
        { fieldName: 'translations', fieldType: 'list<category_translation>' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat({ fieldName: 'html_url', fieldType: 'string' }),
      // serviceUrl is created in help_center_service_url filter
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/categories',
        method: 'post',
        deployAsField: 'category',
      },
      modify: {
        url: '/api/v2/help_center/categories/{category_id}',
        method: 'put',
        deployAsField: 'category',
        urlParamsToFields: {
          category_id: 'id',
        },
      },
      remove: {
        url: '/api/v2/help_center/categories/{category_id}',
        method: 'delete',
        urlParamsToFields: {
          category_id: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  category_translation: {
    transformation: {
      idFields: ['&locale'],
      extendsParentId: true,
      fileNameFields: ['&locale'],
      sourceTypeName: 'category__translations',
      dataField: 'translations',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        { fieldName: 'brand', fieldType: 'number' },
        { fieldName: 'created_by_id', fieldType: 'unknown' },
        { fieldName: 'updated_by_id', fieldType: 'unknown' },
      ],
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        { fieldName: 'html_url', fieldType: 'string' },
        { fieldName: 'source_id', fieldType: 'number' },
        { fieldName: 'source_type', fieldType: 'string' },
      ),
      // serviceUrl is created in help_center_service_url filter
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/categories/{category_id}/translations',
        method: 'post',
        deployAsField: 'translation',
        urlParamsToFields: {
          category_id: '_parent.0.id',
        },
      },
      modify: {
        url: '/api/v2/help_center/categories/{category_id}/translations/{locale}',
        method: 'put',
        deployAsField: 'translation',
        urlParamsToFields: {
          category_id: '_parent.0.id',
          locale: 'locale',
        },
      },
      remove: {
        url: '/api/v2/help_center/translations/{translation_id}',
        method: 'delete',
        urlParamsToFields: {
          translation_id: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  permission_groups: {
    request: {
      url: '/api/v2/guide/permission_groups',
      queryParams: { per_page: String(PAGE_SIZE) },
      paginationField: 'next_page',
    },
    transformation: {
      dataField: 'permission_groups',
    },
  },
  permission_group: {
    transformation: {
      sourceTypeName: 'permission_groups__permission_groups',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
      serviceUrl: '/knowledge/permissions/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/guide/permission_groups',
        deployAsField: 'permission_group',
        method: 'post',
      },
      modify: {
        url: '/api/v2/guide/permission_groups/{permissionGroupId}',
        method: 'put',
        deployAsField: 'permission_group',
        urlParamsToFields: {
          permissionGroupId: 'id',
        },
      },
      remove: {
        url: '/api/v2/guide/permission_groups/{permissionGroupId}',
        method: 'delete',
        urlParamsToFields: {
          permissionGroupId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  user_segments: {
    request: {
      url: '/api/v2/help_center/user_segments',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'user_segments',
    },
  },
  user_segment: {
    transformation: {
      sourceTypeName: 'user_segments__user_segments',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldTypeOverrides: [
        { fieldName: 'id', fieldType: 'number' },
        // list items can be user IDs (number) or user email (string)
        { fieldName: 'added_user_ids', fieldType: 'List<unknown>' },
        // list items can be organization IDs (number) or organization names (email)
        { fieldName: 'organization_ids', fieldType: 'List<unknown>' },
        // everyone user type is added as a type we created for user_segment
        {
          fieldName: 'user_type',
          fieldType: 'string',
          restrictions: { enforce_value: true, values: ['signed_in_users', 'staff', EVERYONE_USER_TYPE] },
        },
      ],
      serviceUrl: '/knowledge/user_segments/edit/{id}',
    },
    deployRequests: {
      add: {
        url: '/api/v2/help_center/user_segments',
        deployAsField: 'user_segment',
        method: 'post',
      },
      modify: {
        url: '/api/v2/help_center/user_segments/{userSegmentId}',
        method: 'put',
        deployAsField: 'user_segment',
        urlParamsToFields: {
          userSegmentId: 'id',
        },
      },
      remove: {
        url: '/api/v2/help_center/user_segments/{userSegmentId}',
        method: 'delete',
        urlParamsToFields: {
          userSegmentId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  // not included yet: satisfaction_reason (returns 403), sunshine apis

  // SALTO-2177 token-related types that can optionally be supported - but are not included under supportedTypes yet
  api_tokens: {
    request: {
      url: '/api/v2/api_tokens',
    },
    transformation: {
      dataField: 'api_tokens',
    },
  },
  api_token: {
    transformation: {
      sourceTypeName: 'api_tokens__api_tokens',
      idFields: ['description'],
      fieldsToHide: [
        {
          fieldName: 'id',
          fieldType: 'number',
        },
      ],
      serviceUrl: '/admin/apps-integrations/apis/zendesk-api/settings/tokens/',
      fieldTypeOverrides: [
        {
          fieldName: 'id',
          fieldType: 'number',
        },
      ],
    },
  },
  oauth_tokens: {
    request: {
      url: '/api/v2/oauth/tokens',
      queryParams: { ...DEFAULT_QUERY_PARAMS },
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'tokens',
    },
  },
  oauth_token: {
    transformation: {
      sourceTypeName: 'oauth_tokens__tokens',
      // note: requires oauth_global_client to be included in the config
      idFields: ['&client_id', 'token'],
      fieldsToHide: [
        {
          fieldName: 'id',
          fieldType: 'number',
        },
      ],
      serviceUrl: '/admin/apps-integrations/apis/zendesk-api/oauth_clients',
      fieldTypeOverrides: [
        {
          fieldName: 'id',
          fieldType: 'number',
        },
      ],
    },
  },
  features: {
    request: {
      url: '/api/v2/account/features',
    },
    transformation: {
      dataField: 'features',
    },
  },
  account_features: {
    transformation: {
      sourceTypeName: 'features__features',
      isSingleton: true,
    },
  },
  custom_objects: {
    request: {
      url: '/api/v2/custom_objects',
      queryParams: { per_page: String(PAGE_SIZE) },
      paginationField: 'next_page',
      recurseInto: [
        {
          type: 'custom_object_fields',
          toField: 'custom_object_fields',
          context: [{ name: 'custom_object_key', fromField: 'key' }],
        },
      ],
    },
    transformation: {
      dataField: 'custom_objects',
    },
  },
  custom_object: {
    transformation: {
      idFields: ['key'],
      sourceTypeName: 'custom_objects__custom_objects',
      standaloneFields: [{ fieldName: 'custom_object_fields' }],
      fieldsToHide: FIELDS_TO_HIDE.concat(
        { fieldName: 'created_by_user_id', fieldType: 'string' },
        { fieldName: 'updated_by_user_id', fieldType: 'string' },
      ),
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        // these fields are generated by their raw_ counterparts, and we create them on preDeploy
        { fieldName: 'title', fieldType: 'string' },
        { fieldName: 'title_pluralized', fieldType: 'string' },
        { fieldName: 'description', fieldType: 'string' },
      ),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
    deployRequests: {
      add: {
        url: '/api/v2/custom_objects',
        method: 'post',
        deployAsField: 'custom_object',
        fieldsToIgnore: ['custom_object_fields'],
      },
      modify: {
        url: '/api/v2/custom_objects/{custom_object_key}',
        method: 'patch',
        deployAsField: 'custom_object',
        fieldsToIgnore: ['custom_object_fields'],
        urlParamsToFields: {
          custom_object_key: 'key',
        },
      },
      remove: {
        url: '/api/v2/custom_objects/{custom_object_key}',
        method: 'delete',
        urlParamsToFields: {
          custom_object_key: 'key',
        },
        omitRequestBody: true,
      },
    },
  },
  custom_object_fields: {
    request: {
      url: '/api/v2/custom_objects/{custom_object_key}/fields',
      queryParams: DEFAULT_QUERY_PARAMS,
      paginationField: CURSOR_BASED_PAGINATION_FIELD,
    },
    transformation: {
      dataField: 'custom_object_fields',
    },
  },
  custom_object_field: {
    transformation: {
      idFields: ['key'],
      extendsParentId: true,
      standaloneFields: [{ fieldName: 'custom_field_options' }],
      sourceTypeName: 'custom_object__custom_object_fields',
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
      fieldsToOmit: FIELDS_TO_OMIT.concat(
        // these fields are generated by their raw_ counterparts, and we create them on preDeploy
        { fieldName: 'description', fieldType: 'string' },
        { fieldName: 'title', fieldType: 'string' },
      ),
      fieldTypeOverrides: [{ fieldName: 'id', fieldType: 'number' }],
    },
    deployRequests: {
      add: {
        url: '/api/v2/custom_objects/{custom_object_key}/fields',
        method: 'post',
        deployAsField: 'custom_object_field',
        urlParamsToFields: {
          custom_object_key: '_parent.0.key',
        },
      },
      modify: {
        url: '/api/v2/custom_objects/{custom_object_key}/fields/{custom_object_field_key}',
        method: 'put',
        deployAsField: 'custom_object_field',
        urlParamsToFields: {
          custom_object_key: '_parent.0.key',
          custom_object_field_key: 'id',
        },
      },
      remove: {
        url: '/api/v2/custom_objects/{custom_object_key}/fields/{custom_object_field_key}',
        method: 'delete',
        urlParamsToFields: {
          custom_object_key: '_parent.0.key',
          custom_object_field_key: 'key',
        },
        omitRequestBody: true,
      },
    },
  },
  // Created in custom_object_field_options.ts
  custom_object_field__custom_field_options: {
    transformation: {
      fieldsToHide: FIELDS_TO_HIDE.concat({ fieldName: 'id', fieldType: 'number' }),
    },
  },
  themes: {
    request: {
      url: '/api/v2/guide/theming/themes',
    },
    transformation: {
      dataField: 'themes',
    },
  },
  theme: {
    transformation: {
      idFields: ['&brand_id', ...DEFAULT_ID_FIELDS],
      sourceTypeName: 'themes__themes',
      fieldTypeOverrides: [{ fieldName: 'root', fieldType: 'theme_folder' }],
      fieldsToHide: FIELDS_TO_HIDE.concat([
        { fieldName: 'id', fieldType: 'string' },
        { fieldName: 'live', fieldType: 'boolean' },
        { fieldName: 'author', fieldType: 'string' },
        { fieldName: 'version', fieldType: 'string' },
      ]),
    },
    deployRequests: {
      remove: {
        url: '/api/v2/guide/theming/themes/{themeId}',
        method: 'delete',
        urlParamsToFields: {
          themeId: 'id',
        },
        omitRequestBody: true,
      },
    },
  },
  theme_file: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'filename', fieldType: 'string' },
        { fieldName: 'content', fieldType: 'unknown' },
      ],
    },
  },
  theme_folder: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'files', fieldType: 'map<theme_file>' },
        { fieldName: 'folders', fieldType: 'map<theme_folder>' },
      ],
    },
  },
  [THEME_SETTINGS_TYPE_NAME]: {
    transformation: {
      fieldTypeOverrides: [
        { fieldName: 'brand', fieldType: 'number' },
        { fieldName: 'liveTheme', fieldType: 'string' },
      ],
    },
  },
}

export const SUPPORTED_TYPES = {
  account_setting: ['account_settings'],
  app_installation: ['app_installations'],
  app_owned: ['apps_owned'],
  automation: ['automations'],
  brand: ['brands'],
  business_hours_schedule: ['business_hours_schedules'],
  custom_role: ['custom_roles'],
  custom_status: ['custom_statuses'],
  dynamic_content_item: ['dynamic_content_item'],
  group: ['groups'],
  layout: ['layouts'],
  locale: ['locales'],
  macro_categories: ['macro_categories'],
  macro: ['macros'],
  monitored_twitter_handle: ['monitored_twitter_handles'],
  oauth_client: ['oauth_clients'],
  oauth_global_client: ['oauth_global_clients'],
  organization: ['organizations'],
  organization_field: ['organization_fields'],
  resource_collection: ['resource_collections'],
  routing_attribute: ['routing_attributes'],
  sharing_agreement: ['sharing_agreements'],
  sla_policy: ['sla_policies'],
  support_address: ['support_addresses'],
  target: ['targets'],
  ticket_field: ['ticket_fields'],
  ticket_form: ['ticket_forms'],
  trigger_category: ['trigger_categories'],
  trigger_definition: ['trigger_definitions'],
  trigger: ['triggers'],
  user_field: ['user_fields'],
  view: ['views'],
  webhook: ['webhooks'],
  workspace: ['workspaces'],
  account_features: ['features'],
  // tags are included in supportedTypes so that they can be easily omitted, but are fetched separately
  tag: ['tags'],
  custom_object: ['custom_objects'],
  [CONVERSATION_BOT]: [CONVERSATION_BOT],
}

// Types in Zendesk Guide which relate to a certain brand
export const GUIDE_BRAND_SPECIFIC_TYPES = {
  article: ['articles'],
  section: ['sections'],
  category: ['categories'],
  guide_settings: ['guide_settings'],
  guide_language_settings: ['guide_language_settings'],
}

// Types in Zendesk Guide that whose instances are shared across all brands
export const GUIDE_GLOBAL_TYPES = {
  permission_group: ['permission_groups'],
  user_segment: ['user_segments'],
  theme: ['themes'],
}

export const GUIDE_SUPPORTED_TYPES = {
  ...GUIDE_BRAND_SPECIFIC_TYPES,
  ...GUIDE_GLOBAL_TYPES,
}

export const GUIDE_TYPES_TO_HANDLE_BY_BRAND = [
  ...Object.keys(GUIDE_BRAND_SPECIFIC_TYPES),
  'article_translation',
  'category_translation',
  'section_translation',
  ARTICLE_ATTACHMENT_TYPE_NAME,
  CATEGORY_ORDER_TYPE_NAME,
  SECTION_ORDER_TYPE_NAME,
  ARTICLE_ORDER_TYPE_NAME,
]

export const DEFAULT_CONFIG: ZendeskConfig = {
  [FETCH_CONFIG]: {
    include: [
      {
        type: elements.query.ALL_TYPES,
      },
    ],
    exclude: [{ type: 'organization' }, { type: 'oauth_global_client' }],
    hideTypes: true,
    enableMissingReferences: true,
    resolveOrganizationIDs: false,
    resolveUserIDs: true,
    includeAuditDetails: false,
    handleIdenticalAttachmentConflicts: false,
    omitInactive: {
      default: OMIT_INACTIVE_DEFAULT,
    },
    omitTicketStatusTicketField: false,
    translationBodyAsStaticFile: true,
    fetchBotBuilder: false,
  },
  [DEPLOY_CONFIG]: {
    createMissingOrganizations: false,
  },
  [FIX_ELEMENTS_CONFIG]: {
    mergeLists: false,
    fallbackUsers: true,
    removeDupUsers: true,
    orderElements: true,
    deployArticlesAsDraft: false,
    fixTicketForms: true,
  },
  [API_DEFINITIONS_CONFIG]: {
    typeDefaults: {
      request: {
        paginationField: 'next_page',
      },
      transformation: {
        idFields: DEFAULT_ID_FIELDS,
        fileNameFields: DEFAULT_FILENAME_FIELDS,
        fieldsToOmit: FIELDS_TO_OMIT,
        fieldsToHide: FIELDS_TO_HIDE,
        serviceIdField: DEFAULT_SERVICE_ID_FIELD,
        // TODO: change this to true for SALTO-3593.
        nestStandaloneInstances: false,
      },
    },
    types: DEFAULT_TYPES,
    supportedTypes: SUPPORTED_TYPES,
  },
}

const IdLocatorType = createMatchingObjectType<IdLocator>({
  elemID: new ElemID(ZENDESK, 'IdLocatorType'),
  fields: {
    fieldRegex: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    idRegex: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    type: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        _required: true,
      },
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const ThemesReferenceJavascriptReferenceLookupStrategyType = createMatchingObjectType<
  Themes['referenceOptions']['javascriptReferenceLookupStrategy']
>({
  elemID: new ElemID(ZENDESK, 'ThemesReferenceJavascriptReferenceLookupStrategyType'),
  fields: {
    strategy: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: true,
      },
    },
    minimumDigitAmount: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        _required: false,
      },
    },
    prefix: {
      refType: BuiltinTypes.STRING,
      annotations: {
        _required: false,
      },
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const ThemesReferenceType = createMatchingObjectType<Themes['referenceOptions']>({
  elemID: new ElemID(ZENDESK, 'ThemeType-referenceOptions'),
  fields: {
    enableReferenceLookup: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        _required: true,
      },
    },
    javascriptReferenceLookupStrategy: {
      refType: ThemesReferenceJavascriptReferenceLookupStrategyType,
    },
  },
})

const ThemesType = createMatchingObjectType<Themes>({
  elemID: new ElemID(ZENDESK, 'ThemeType'),
  fields: {
    brands: {
      refType: new ListType(BuiltinTypes.STRING),
    },
    referenceOptions: {
      refType: ThemesReferenceType,
      annotations: {
        _required: true,
      },
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const GuideType = createMatchingObjectType<Guide>({
  elemID: new ElemID(ZENDESK, 'GuideType'),
  fields: {
    brands: {
      refType: new ListType(BuiltinTypes.STRING),
      annotations: {
        _required: true,
      },
    },
    themes: {
      refType: ThemesType,
    },
    // Deprecated
    themesForBrands: {
      refType: new ListType(BuiltinTypes.STRING),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const OmitInactiveType = createMatchingObjectType<OmitInactiveConfig>({
  elemID: new ElemID(ZENDESK, 'OmitInactiveType'),
  fields: {
    default: {
      refType: BuiltinTypes.BOOLEAN,
    },
    customizations: {
      refType: new MapType(BuiltinTypes.BOOLEAN),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export type ChangeValidatorName =
  | 'deployTypesNotSupported'
  | 'createCheckDeploymentBasedOnDefinitions'
  | 'accountSettings'
  | 'emptyCustomFieldOptions'
  | 'emptyVariants'
  | 'parentAnnotationToHaveSingleValue'
  | 'missingFromParent'
  | 'childMissingParentAnnotation'
  | 'removedFromParent'
  | 'duplicateCustomFieldOptionValues'
  | 'noDuplicateLocaleIdInDynamicContentItem'
  | 'onlyOneTicketFormDefault'
  | 'customRoleName'
  | 'orderInstanceContainsAllTheInstances'
  | 'triggerOrderInstanceContainsAllTheInstances'
  | 'brandCreation'
  | 'webhookAuthData'
  | 'targetAuthData'
  | 'phoneNumbers'
  | 'automationAllConditions'
  | 'macroActionsTicketFieldDeactivation'
  | 'customStatusesEnabled'
  | 'customStatusUniqueAgentLabel'
  | 'customStatusCategoryChange'
  | 'customStatusCategory'
  | 'customStatusActiveDefault'
  | 'defaultCustomStatuses'
  | 'customRoleRemoval'
  | 'sideConversations'
  | 'users'
  | 'requiredAppOwnedParameters'
  | 'oneTranslationPerLocale'
  | 'articleRemoval'
  | 'articleLabelNamesRemoval'
  | 'articleAttachmentSize'
  | 'everyoneUserSegmentModification'
  | 'brandFieldForBrandBasedElements'
  | 'translationForDefaultLocale'
  | 'helpCenterActivation'
  | 'helpCenterCreationOrRemoval'
  | 'externalSourceWebhook'
  | 'defaultGroupChange'
  | 'organizationExistence'
  | 'badFormatWebhookAction'
  | 'guideDisabled'
  | 'guideThemeDeleteLive'
  | 'guideThemeUpdateMetadata'
  | 'additionOfTicketStatusForTicketForm'
  | 'defaultDynamicContentItemVariant'
  | 'featureActivation'
  | 'standardFields'
  | 'defaultAutomationRemoval'
  | 'deflectionAction'
  | 'uniqueAutomationConditions'
  | 'triggerCategoryRemoval'
  | 'childInOrder'
  | 'childrenReferences'
  | 'orderChildrenParent'
  | 'guideOrderDeletion'
  | 'attachmentWithoutContent'
  | 'duplicateRoutingAttributeValue'
  | 'ticketFieldDeactivation'
  | 'duplicateIdFieldValues'
  | 'duplicateDynamicContentItem'
  | 'notEnabledMissingReferences'
  | 'conditionalTicketFields'
  | 'dynamicContentDeletion'
  | 'dynamicContentPlaceholderModification'
  | 'inactiveTicketFormInView'
  | 'immutableTypeAndKeyForUserFields'
  | 'localeModification'
  | 'emptyAutomationOrder'
  | 'viewCustomStatusConditions'
  | 'businessHoursScheduleHoliday'
  | 'defaultSupportAddress'

type ChangeValidatorConfig = Partial<Record<ChangeValidatorName, boolean>>

const changeValidatorConfigType = createMatchingObjectType<ChangeValidatorConfig>({
  elemID: new ElemID(ZENDESK, 'changeValidatorConfig'),
  fields: {
    deployTypesNotSupported: { refType: BuiltinTypes.BOOLEAN },
    createCheckDeploymentBasedOnDefinitions: { refType: BuiltinTypes.BOOLEAN },
    accountSettings: { refType: BuiltinTypes.BOOLEAN },
    emptyCustomFieldOptions: { refType: BuiltinTypes.BOOLEAN },
    emptyVariants: { refType: BuiltinTypes.BOOLEAN },
    parentAnnotationToHaveSingleValue: { refType: BuiltinTypes.BOOLEAN },
    missingFromParent: { refType: BuiltinTypes.BOOLEAN },
    childMissingParentAnnotation: { refType: BuiltinTypes.BOOLEAN },
    removedFromParent: { refType: BuiltinTypes.BOOLEAN },
    duplicateCustomFieldOptionValues: { refType: BuiltinTypes.BOOLEAN },
    noDuplicateLocaleIdInDynamicContentItem: { refType: BuiltinTypes.BOOLEAN },
    onlyOneTicketFormDefault: { refType: BuiltinTypes.BOOLEAN },
    customRoleName: { refType: BuiltinTypes.BOOLEAN },
    orderInstanceContainsAllTheInstances: { refType: BuiltinTypes.BOOLEAN },
    triggerOrderInstanceContainsAllTheInstances: { refType: BuiltinTypes.BOOLEAN },
    brandCreation: { refType: BuiltinTypes.BOOLEAN },
    webhookAuthData: { refType: BuiltinTypes.BOOLEAN },
    targetAuthData: { refType: BuiltinTypes.BOOLEAN },
    phoneNumbers: { refType: BuiltinTypes.BOOLEAN },
    automationAllConditions: { refType: BuiltinTypes.BOOLEAN },
    macroActionsTicketFieldDeactivation: { refType: BuiltinTypes.BOOLEAN },
    customStatusesEnabled: { refType: BuiltinTypes.BOOLEAN },
    customStatusUniqueAgentLabel: { refType: BuiltinTypes.BOOLEAN },
    customStatusCategoryChange: { refType: BuiltinTypes.BOOLEAN },
    customStatusCategory: { refType: BuiltinTypes.BOOLEAN },
    customStatusActiveDefault: { refType: BuiltinTypes.BOOLEAN },
    defaultCustomStatuses: { refType: BuiltinTypes.BOOLEAN },
    customRoleRemoval: { refType: BuiltinTypes.BOOLEAN },
    sideConversations: { refType: BuiltinTypes.BOOLEAN },
    users: { refType: BuiltinTypes.BOOLEAN },
    requiredAppOwnedParameters: { refType: BuiltinTypes.BOOLEAN },
    oneTranslationPerLocale: { refType: BuiltinTypes.BOOLEAN },
    articleRemoval: { refType: BuiltinTypes.BOOLEAN },
    articleLabelNamesRemoval: { refType: BuiltinTypes.BOOLEAN },
    articleAttachmentSize: { refType: BuiltinTypes.BOOLEAN },
    everyoneUserSegmentModification: { refType: BuiltinTypes.BOOLEAN },
    brandFieldForBrandBasedElements: { refType: BuiltinTypes.BOOLEAN },
    translationForDefaultLocale: { refType: BuiltinTypes.BOOLEAN },
    helpCenterActivation: { refType: BuiltinTypes.BOOLEAN },
    helpCenterCreationOrRemoval: { refType: BuiltinTypes.BOOLEAN },
    externalSourceWebhook: { refType: BuiltinTypes.BOOLEAN },
    defaultGroupChange: { refType: BuiltinTypes.BOOLEAN },
    organizationExistence: { refType: BuiltinTypes.BOOLEAN },
    badFormatWebhookAction: { refType: BuiltinTypes.BOOLEAN },
    guideDisabled: { refType: BuiltinTypes.BOOLEAN },
    guideThemeDeleteLive: { refType: BuiltinTypes.BOOLEAN },
    guideThemeUpdateMetadata: { refType: BuiltinTypes.BOOLEAN },
    additionOfTicketStatusForTicketForm: { refType: BuiltinTypes.BOOLEAN },
    defaultDynamicContentItemVariant: { refType: BuiltinTypes.BOOLEAN },
    featureActivation: { refType: BuiltinTypes.BOOLEAN },
    standardFields: { refType: BuiltinTypes.BOOLEAN },
    defaultAutomationRemoval: { refType: BuiltinTypes.BOOLEAN },
    attachmentWithoutContent: { refType: BuiltinTypes.BOOLEAN },
    deflectionAction: { refType: BuiltinTypes.BOOLEAN },
    uniqueAutomationConditions: { refType: BuiltinTypes.BOOLEAN },
    triggerCategoryRemoval: { refType: BuiltinTypes.BOOLEAN },
    childInOrder: { refType: BuiltinTypes.BOOLEAN },
    childrenReferences: { refType: BuiltinTypes.BOOLEAN },
    orderChildrenParent: { refType: BuiltinTypes.BOOLEAN },
    guideOrderDeletion: { refType: BuiltinTypes.BOOLEAN },
    duplicateRoutingAttributeValue: { refType: BuiltinTypes.BOOLEAN },
    ticketFieldDeactivation: { refType: BuiltinTypes.BOOLEAN },
    duplicateIdFieldValues: { refType: BuiltinTypes.BOOLEAN },
    duplicateDynamicContentItem: { refType: BuiltinTypes.BOOLEAN },
    notEnabledMissingReferences: { refType: BuiltinTypes.BOOLEAN },
    conditionalTicketFields: { refType: BuiltinTypes.BOOLEAN },
    dynamicContentDeletion: { refType: BuiltinTypes.BOOLEAN },
    dynamicContentPlaceholderModification: { refType: BuiltinTypes.BOOLEAN },
    inactiveTicketFormInView: { refType: BuiltinTypes.BOOLEAN },
    immutableTypeAndKeyForUserFields: { refType: BuiltinTypes.BOOLEAN },
    localeModification: { refType: BuiltinTypes.BOOLEAN },
    emptyAutomationOrder: { refType: BuiltinTypes.BOOLEAN },
    viewCustomStatusConditions: { refType: BuiltinTypes.BOOLEAN },
    businessHoursScheduleHoliday: { refType: BuiltinTypes.BOOLEAN },
    defaultSupportAddress: { refType: BuiltinTypes.BOOLEAN },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

const fixerConfigType = createMatchingObjectType<Partial<ZendeskFixElementsConfig>>({
  elemID: new ElemID(ZENDESK, 'fixElementsConfig'),
  fields: {
    mergeLists: { refType: BuiltinTypes.BOOLEAN },
    fallbackUsers: { refType: BuiltinTypes.BOOLEAN },
    removeDupUsers: { refType: BuiltinTypes.BOOLEAN },
    orderElements: { refType: BuiltinTypes.BOOLEAN },
    deployArticlesAsDraft: { refType: BuiltinTypes.BOOLEAN },
    fixTicketForms: { refType: BuiltinTypes.BOOLEAN },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

type ZendeskFetchCriteria = {
  name?: string
  key?: string
  raw_title?: string
  title?: string
  type?: string
}

const zendeskFetchCriteriaType = createMatchingObjectType<ZendeskFetchCriteria>({
  elemID: new ElemID(ZENDESK, 'FetchFilters'),
  fields: {
    name: { refType: BuiltinTypes.STRING },
    key: { refType: BuiltinTypes.STRING },
    raw_title: { refType: BuiltinTypes.STRING },
    title: { refType: BuiltinTypes.STRING },
    type: { refType: BuiltinTypes.STRING },
  },
  annotations: {
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export const configType = createMatchingObjectType<Partial<ZendeskConfig>>({
  elemID: new ElemID(ZENDESK),
  fields: {
    [CLIENT_CONFIG]: {
      refType: createClientConfigType({ adapter: ZENDESK }),
    },
    [FETCH_CONFIG]: {
      refType: definitions.createUserFetchConfigType({
        fetchCriteriaType: zendeskFetchCriteriaType,
        adapterName: ZENDESK,
        additionalFields: {
          enableMissingReferences: { refType: BuiltinTypes.BOOLEAN },
          resolveUserIDs: { refType: BuiltinTypes.BOOLEAN },
          includeAuditDetails: { refType: BuiltinTypes.BOOLEAN },
          handleIdenticalAttachmentConflicts: { refType: BuiltinTypes.BOOLEAN },
          greedyAppReferences: { refType: BuiltinTypes.BOOLEAN },
          appReferenceLocators: { refType: IdLocatorType },
          guide: { refType: GuideType },
          resolveOrganizationIDs: { refType: BuiltinTypes.BOOLEAN },
          extractReferencesFromFreeText: { refType: BuiltinTypes.BOOLEAN },
          convertJsonIdsToReferences: { refType: BuiltinTypes.BOOLEAN },
          omitInactive: { refType: OmitInactiveType },
          omitTicketStatusTicketField: { refType: BuiltinTypes.BOOLEAN },
          translationBodyAsStaticFile: { refType: BuiltinTypes.BOOLEAN },
          fetchBotBuilder: { refType: BuiltinTypes.BOOLEAN },
        },
        omitElemID: true,
      }),
    },
    [DEPLOY_CONFIG]: {
      refType: definitions.createUserDeployConfigType(ZENDESK, changeValidatorConfigType, {
        ...defaultMissingUserFallbackField,
        createMissingOrganizations: { refType: BuiltinTypes.BOOLEAN },
      }),
    },
    [FIX_ELEMENTS_CONFIG]: {
      refType: fixerConfigType,
    },
    [API_DEFINITIONS_CONFIG]: {
      refType: createDucktypeAdapterApiConfigType({
        adapter: ZENDESK,
        additionalTransformationFields: { omitInactive: { refType: BuiltinTypes.BOOLEAN } },
      }),
    },
  },
  annotations: {
    [CORE_ANNOTATIONS.DEFAULT]: _.omit(
      DEFAULT_CONFIG,
      API_DEFINITIONS_CONFIG,
      `${FETCH_CONFIG}.hideTypes`,
      `${FETCH_CONFIG}.enableMissingReferences`,
      `${FETCH_CONFIG}.guide`,
      `${FETCH_CONFIG}.resolveOrganizationIDs`,
      `${FETCH_CONFIG}.resolveUserIDs`,
      `${FETCH_CONFIG}.includeAuditDetails`,
      `${FETCH_CONFIG}.handleIdenticalAttachmentConflicts`,
      `${FETCH_CONFIG}.extractReferencesFromFreeText`,
      `${FETCH_CONFIG}.convertJsonIdsToReferences`,
      `${FETCH_CONFIG}.omitInactive.customizations`,
      `${FETCH_CONFIG}.omitTicketStatusTicketField`,
      `${FETCH_CONFIG}.translationBodyAsStaticFile`,
      `${FETCH_CONFIG}.fetchBotBuilder`,
      DEPLOY_CONFIG,
      FIX_ELEMENTS_CONFIG,
    ),
    [CORE_ANNOTATIONS.ADDITIONAL_PROPERTIES]: false,
  },
})

export const validateFetchConfig = (
  fetchConfigPath: string,
  userFetchConfig: definitions.UserFetchConfig<{ customNameMappingOptions: never }>,
  adapterApiConfig: configUtils.AdapterApiConfig,
): void =>
  validateDuckTypeFetchConfig(
    fetchConfigPath,
    userFetchConfig,
    _.defaults({}, adapterApiConfig, {
      supportedTypes: {
        tag: ['tags'],
      },
    }),
  )

export const isGuideEnabled = (fetchConfig: ZendeskFetchConfig): boolean => fetchConfig.guide?.brands !== undefined

export const isGuideThemesEnabled = (fetchConfig: ZendeskFetchConfig): boolean =>
  (fetchConfig.guide?.themes?.brands !== undefined && fetchConfig.guide?.themes?.brands.length > 0) ||
  // Deprecated
  (fetchConfig.guide?.themesForBrands !== undefined && fetchConfig.guide?.themesForBrands.length > 0)

export const validateOmitInactiveConfig = (
  omitInactiveConfig: OmitInactiveConfig | undefined,
  adapterApiConfig: configUtils.AdapterApiConfig,
): void => {
  if (omitInactiveConfig !== undefined) {
    validateDefaultWithCustomizations(
      'omitInactive',
      omitInactiveConfig,
      _.defaults({}, adapterApiConfig, {
        supportedTypes: {
          tag: ['tags'],
        },
      }),
    )
  }
}
export const validateFixElementsConfig = (FixElementsConfig: ZendeskFixElementsConfig | undefined): void => {
  if (FixElementsConfig !== undefined) {
    if (!Object.keys(FixElementsConfig).every(fixerName => (fixerNames as unknown as string[]).includes(fixerName))) {
      throw Error('Invalid Zendesk fixElements config. One of the keys is invalid')
    }
  }
}
