/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { PRIORITY_SCHEME_TYPE_NAME } from '../../constants'
import { JiraApiConfig } from '../../config/api_config'

export const DC_ADDITIONAL_TYPE_NAME_OVERRIDES = [
  {
    originalName: 'rest__api__3__priority',
    newName: 'Priorities',
  },
  {
    originalName: 'rest__api__3__project',
    newName: 'Projects',
  },
  {
    originalName: 'rest__api__3__project___projectIdOrKey___components@uuuuuuuu_00123_00125uu',
    newName: 'ProjectComponents',
  },
]

export const DC_DEFAULT_API_DEFINITIONS: Partial<JiraApiConfig> = {
  types: {
    IssueEvent: {
      deployRequests: {
        add: {
          url: '/rest/api/3/events',
          method: 'post',
        },
        modify: {
          url: '/rest/api/3/events',
          method: 'put',
        },
        remove: {
          url: '/rest/api/3/events?id={id}',
          method: 'delete',
          omitRequestBody: true,
        },
      },
    },
    Dashboard: {
      transformation: {
        serviceUrl: '/secure/Dashboard.jspa?selectPageId={id}',
      },
    },
    DashboardGadget: {
      transformation: {
        idFields: ['position.column', 'position.row'],
      },
    },
    Automation: {
      transformation: {
        serviceUrl: '/secure/AutomationGlobalAdminAction!default.jspa#/rule/{id}',
      },
    },
    Priorities: {
      request: {
        url: '/rest/api/3/priority',
      },
      transformation: {
        dataField: '.',
      },
    },
    Projects: {
      request: {
        url: '/rest/api/3/project',
        queryParams: {
          expand: 'description,lead,url',
        },
        recurseInto: [
          {
            type: 'ProjectComponents',
            toField: 'components',
            context: [{ name: 'projectIdOrKey', fromField: 'id' }],
          },
          {
            type: 'ContainerOfWorkflowSchemeAssociations',
            toField: 'workflowScheme',
            context: [{ name: 'projectId', fromField: 'id' }],
            isSingle: true,
          },
          {
            type: 'PermissionScheme',
            toField: 'permissionScheme',
            context: [{ name: 'projectId', fromField: 'id' }],
            isSingle: true,
          },
          {
            type: 'NotificationScheme',
            toField: 'notificationScheme',
            context: [{ name: 'projectId', fromField: 'id' }],
            isSingle: true,
          },
          {
            type: 'ProjectSecurityScheme',
            toField: 'issueSecurityScheme',
            context: [{ name: 'projectKeyOrId', fromField: 'key' }],
            isSingle: true,
          },
          {
            type: 'PageBeanIssueTypeScreenSchemesProjects',
            toField: 'issueTypeScreenScheme',
            context: [{ name: 'projectId', fromField: 'id' }],
            isSingle: true,
          },
          {
            type: 'PageBeanIssueTypeSchemeProjects',
            toField: 'issueTypeScheme',
            context: [{ name: 'projectId', fromField: 'id' }],
            isSingle: true,
          },
          {
            type: 'PageBeanFieldConfigurationSchemeProjects',
            toField: 'fieldConfigurationScheme',
            context: [{ name: 'projectId', fromField: 'id' }],
            isSingle: true,
          },
        ],
      },
      transformation: {
        dataField: '.',
      },
    },
    ProjectComponents: {
      request: {
        url: '/rest/api/3/project/{projectIdOrKey}/components',
      },
      transformation: {
        dataField: '.',
      },
    },
    NotificationScheme: {
      deployRequests: {
        add: {
          url: '/rest/api/3/notificationscheme',
          method: 'post',
        },
        modify: {
          url: '/rest/api/3/notificationscheme/{id}',
          method: 'put',
          // Overrides fieldsToIgnore in default apiDefinitions
          fieldsToIgnore: [],
        },
        remove: {
          url: '/rest/api/3/notificationscheme/{id}',
          method: 'delete',
          omitRequestBody: true,
        },
      },
    },
    SecurityLevel: {
      deployRequests: {
        add: {
          url: '/rest/api/3/securitylevel?securitySchemeId={schemeId}',
          method: 'post',
          fieldsToIgnore: ['schemeId'],
        },
        modify: {
          url: '/rest/api/3/securitylevel?securitySchemeId={schemeId}',
          method: 'put',
          fieldsToIgnore: ['schemeId', 'levelId'],
        },
        remove: {
          url: '/rest/api/3/securitylevel/{levelId}',
          method: 'delete',
          omitRequestBody: true,
        },
      },
    },
    SecurityScheme: {
      deployRequests: {
        add: {
          url: '/rest/api/3/issuesecurityschemes',
          method: 'post',
          fieldsToIgnore: ['defaultLevel', 'levels'],
        },
        modify: {
          url: '/rest/api/3/issuesecurityschemes',
          method: 'put',
          fieldsToIgnore: ['schemeId', 'levels'],
        },
        remove: {
          url: '/rest/api/3/issuesecurityschemes/{id}',
          method: 'delete',
          omitRequestBody: true,
        },
      },
    },
  },
  supportedTypes: {
    [PRIORITY_SCHEME_TYPE_NAME]: [],
  },
}
