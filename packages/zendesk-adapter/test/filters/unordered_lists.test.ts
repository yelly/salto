/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  InstanceElement,
  Element,
  isInstanceElement,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import {
  BRAND_TYPE_NAME,
  GROUP_TYPE_NAME,
  MACRO_TYPE_NAME,
  ROUTING_ATTRIBUTE_TYPE_NAME,
  ROUTING_ATTRIBUTE_VALUE_TYPE_NAME,
  TICKET_FIELD_CUSTOM_FIELD_OPTION,
  TICKET_FIELD_TYPE_NAME,
  TICKET_FORM_TYPE_NAME,
  VIEW_TYPE_NAME,
  WORKSPACE_TYPE_NAME,
  ZENDESK,
} from '../../src/constants'
import filterCreator from '../../src/filters/unordered_lists'
import { createFilterCreatorParams } from '../utils'
import { DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME } from '../../src/filters/dynamic_content'

describe('Unordered lists filter', () => {
  type FilterType = filterUtils.FilterWith<'onFetch'>
  let filter: FilterType

  const generateElements = (): Element[] => {
    const localeType = new ObjectType({ elemID: new ElemID(ZENDESK, 'locale') })
    const dynamicContentItemType = new ObjectType({ elemID: new ElemID(ZENDESK, 'dynamic_content_item') })
    const triggerDefinitionType = new ObjectType({ elemID: new ElemID(ZENDESK, 'trigger_definition') })
    const macroType = new ObjectType({ elemID: new ElemID(ZENDESK, MACRO_TYPE_NAME) })
    const workspaceType = new ObjectType({ elemID: new ElemID(ZENDESK, 'workspace') })
    const routingAttributeType = new ObjectType({ elemID: new ElemID(ZENDESK, ROUTING_ATTRIBUTE_TYPE_NAME) })
    const routingAttributeValueType = new ObjectType({ elemID: new ElemID(ZENDESK, ROUTING_ATTRIBUTE_VALUE_TYPE_NAME) })
    const viewType = new ObjectType({ elemID: new ElemID(ZENDESK, VIEW_TYPE_NAME) })
    const groupType = new ObjectType({ elemID: new ElemID(ZENDESK, GROUP_TYPE_NAME) })
    const ticketFormType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FORM_TYPE_NAME) })
    const ticketCustomFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_CUSTOM_FIELD_OPTION) })
    const ticketFieldType = new ObjectType({ elemID: new ElemID(ZENDESK, TICKET_FIELD_TYPE_NAME) })
    const dynamicContentItemVariantType = new ObjectType({
      elemID: new ElemID(ZENDESK, DYNAMIC_CONTENT_ITEM_VARIANT_TYPE_NAME),
    })
    const brandType = new ObjectType({ elemID: new ElemID(ZENDESK, BRAND_TYPE_NAME) })
    const ticketFieldOneInstance = new InstanceElement('fieldA', ticketFieldType, { raw_title: 'a' })
    const ticketFieldThreeInstance = new InstanceElement('fieldC', ticketFieldType, { raw_title: 'c' })
    const invalidTicketFieldInstance = new InstanceElement('invalid field', ticketFieldType, {})
    const customOneInstance = new InstanceElement('customA', ticketCustomFieldType, { value: 'a' })
    const customThreeInstance = new InstanceElement('customC', ticketCustomFieldType, { value: 'c' })
    const brandOneInstance = new InstanceElement('zzzBrand', brandType, { name: 'zzzBrand' })
    const brandTwoInstance = new InstanceElement('heyBrand', brandType, { name: 'heyBrand' })
    const validTicketFormInstance = new InstanceElement('valid form', ticketFormType, {
      agent_conditions: [
        {
          value: new ReferenceExpression(customThreeInstance.elemID, customThreeInstance),
        },
        {
          value: new ReferenceExpression(customOneInstance.elemID, customOneInstance),
          child_fields: [
            {
              id: new ReferenceExpression(ticketFieldThreeInstance.elemID, ticketFieldThreeInstance),
            },
            {
              id: new ReferenceExpression(ticketFieldOneInstance.elemID, ticketFieldOneInstance),
            },
          ],
        },
        {
          parent_field_id: new ReferenceExpression(customThreeInstance.elemID, customThreeInstance),
          value: true,
        },
        {
          value: 'b',
        },
        {
          parent_field_id: new ReferenceExpression(customOneInstance.elemID, customOneInstance),
          value: true,
        },
      ],
      end_user_conditions: [
        {
          value: new ReferenceExpression(customThreeInstance.elemID, customThreeInstance),
        },
        {
          value: new ReferenceExpression(customOneInstance.elemID, customOneInstance),
          child_fields: [
            {
              id: new ReferenceExpression(ticketFieldThreeInstance.elemID, ticketFieldThreeInstance),
            },
            {
              id: new ReferenceExpression(ticketFieldOneInstance.elemID, ticketFieldOneInstance),
            },
          ],
        },
        {
          value: 'b',
        },
      ],
      restricted_brand_ids: [
        new ReferenceExpression(brandOneInstance.elemID, brandOneInstance),
        new ReferenceExpression(brandTwoInstance.elemID, brandTwoInstance),
      ],
    })
    const invalidTicketFormInstance = new InstanceElement('invalid form', ticketFormType, {
      agent_conditions: [
        {},
        {
          value: new ReferenceExpression(customOneInstance.elemID, customOneInstance),
        },
        {
          value: 'b',
        },
      ],
      end_user_conditions: [],
    })
    const invalidChildFieldTicketFormInstance = new InstanceElement('invalid child field form', ticketFormType, {
      agent_conditions: [
        {
          value: new ReferenceExpression(customOneInstance.elemID, customOneInstance),
          child_fields: [
            {
              id: 123,
            },
            {
              id: new ReferenceExpression(ticketFieldOneInstance.elemID, ticketFieldOneInstance),
            },
          ],
        },
        {
          value: new ReferenceExpression(customThreeInstance.elemID, customThreeInstance),
          child_fields: [
            {
              id: new ReferenceExpression(invalidTicketFieldInstance.elemID, invalidTicketFieldInstance),
            },
            {
              id: new ReferenceExpression(ticketFieldOneInstance.elemID, ticketFieldOneInstance),
            },
          ],
        },
      ],
      end_user_conditions: [
        {
          value: new ReferenceExpression(customThreeInstance.elemID, customThreeInstance),
        },
        {
          value: new ReferenceExpression(customOneInstance.elemID, customOneInstance),
          child_fields: [
            {
              id: new ReferenceExpression(ticketFieldThreeInstance.elemID, ticketFieldThreeInstance),
            },
            {
              id: new ReferenceExpression(ticketFieldOneInstance.elemID, ticketFieldOneInstance),
            },
          ],
        },
        {
          value: 'b',
        },
      ],
    })
    const groupOneInstance = new InstanceElement('groupA', groupType, { name: 'a' })
    const groupTwoInstance = new InstanceElement('groupB', groupType, { name: 'b' })
    const groupThreeInstance = new InstanceElement('groupC', groupType, { name: 'c' })
    const validMacroInstance = new InstanceElement('valid macro', macroType, {
      restriction: {
        ids: [
          new ReferenceExpression(groupThreeInstance.elemID, groupThreeInstance),
          new ReferenceExpression(groupOneInstance.elemID, groupOneInstance),
          new ReferenceExpression(groupTwoInstance.elemID, groupTwoInstance),
        ],
      },
    })
    const validViewInstance = new InstanceElement('valid view', viewType, {
      restriction: {
        ids: [
          new ReferenceExpression(groupThreeInstance.elemID, groupThreeInstance),
          new ReferenceExpression(groupOneInstance.elemID, groupOneInstance),
          new ReferenceExpression(groupTwoInstance.elemID, groupTwoInstance),
        ],
      },
    })
    const macroWithValuesInstance = new InstanceElement('values macro', macroType, {
      restriction: {
        ids: [
          123,
          new ReferenceExpression(groupOneInstance.elemID, groupOneInstance),
          new ReferenceExpression(groupTwoInstance.elemID, groupTwoInstance),
        ],
      },
    })
    const viewWithValuesInstance = new InstanceElement('values view', viewType, {
      restriction: {
        ids: [
          123,
          new ReferenceExpression(groupOneInstance.elemID, groupOneInstance),
          new ReferenceExpression(groupTwoInstance.elemID, groupTwoInstance),
        ],
      },
    })
    const invalidMacroInstance1 = new InstanceElement('invalid macro1', macroType, {})
    const invalidViewInstance1 = new InstanceElement('invalid view1', viewType, {})
    const invalidMacroInstance2 = new InstanceElement('invalid macro2', macroType, {
      restriction: {
        id: 123,
      },
    })
    const invalidViewInstance2 = new InstanceElement('invalid view2', viewType, {
      restriction: {
        id: 123,
      },
    })
    const localeEN = new InstanceElement('en_US', localeType, { locale: 'en-US' })
    const localeHE = new InstanceElement('he', localeType, { locale: 'he' })
    const localeES = new InstanceElement('es', localeType, { locale: 'es' })
    const enVariantInstance = new InstanceElement('en-variant', dynamicContentItemVariantType, {
      locale_id: new ReferenceExpression(localeEN.elemID, localeEN),
      content: 'a',
    })
    const heVariantInstance = new InstanceElement('he-variant', dynamicContentItemVariantType, {
      locale_id: new ReferenceExpression(localeHE.elemID, localeHE),
      content: 'c',
    })
    const esVariantInstance = new InstanceElement('es-variant', dynamicContentItemVariantType, {
      locale_id: new ReferenceExpression(localeES.elemID, localeES),
      content: 'b',
    })
    const enVariantNotPopulatedInstance = new InstanceElement(
      'en-variant not populated',
      dynamicContentItemVariantType,
      { locale_id: new ReferenceExpression(localeEN.elemID), content: 'a' },
    )
    const enVariantWithValuesInstance = new InstanceElement('en-variant no locale', dynamicContentItemVariantType, {
      locale_id: 3,
      content: 'a',
    })
    const withPopulatedRefs = new InstanceElement('refs', dynamicContentItemType, {
      variants: [
        new ReferenceExpression(enVariantInstance.elemID, enVariantInstance),
        new ReferenceExpression(heVariantInstance.elemID, heVariantInstance),
        new ReferenceExpression(esVariantInstance.elemID, esVariantInstance),
      ],
    })
    const withSomeUnpopulatedRefs = new InstanceElement('missingRefs', dynamicContentItemType, {
      variants: [
        new ReferenceExpression(enVariantInstance.elemID),
        new ReferenceExpression(heVariantInstance.elemID),
        new ReferenceExpression(esVariantInstance.elemID, esVariantInstance),
      ],
    })
    const withSomeUnpopulatedLocaleRefs = new InstanceElement('missingLocalRefs', dynamicContentItemType, {
      variants: [
        new ReferenceExpression(enVariantNotPopulatedInstance.elemID, enVariantNotPopulatedInstance),
        new ReferenceExpression(heVariantInstance.elemID, heVariantInstance),
        new ReferenceExpression(esVariantInstance.elemID, esVariantInstance),
      ],
    })
    const withSomeValues = new InstanceElement('vals', dynamicContentItemType, {
      variants: [
        123,
        new ReferenceExpression(heVariantInstance.elemID, heVariantInstance),
        new ReferenceExpression(esVariantInstance.elemID, esVariantInstance),
      ],
    })
    const withSomeValuesForLocal = new InstanceElement('valsLocal', dynamicContentItemType, {
      variants: [
        new ReferenceExpression(enVariantWithValuesInstance.elemID, enVariantWithValuesInstance),
        new ReferenceExpression(heVariantInstance.elemID, heVariantInstance),
        new ReferenceExpression(esVariantInstance.elemID, esVariantInstance),
      ],
    })
    const unsortedTriggerDefinitionInstance = new InstanceElement('unsorted', triggerDefinitionType, {
      actions: [
        { title: 'alpha', type: 'bravo' },
        { title: 'charlie', type: 'charlie' },
        { title: 'alpha', type: 'alpha' },
      ],
      conditions_all: [
        { title: 'alpha', type: 'alpha' },
        { title: 'charlie', type: 'bravo' },
        { title: 'bravo', type: 'bravo' },
      ],
      conditions_any: [
        { title: 'charlie', type: 'charlie' },
        { title: 'bravo', type: 'bravo' },
        { title: 'bravo', type: 'alpha' },
      ],
    })
    const referenceExpressionInWorkspaceApps = new ReferenceExpression(new ElemID('zendesk', 'd'))
    const workspaceWithMultipleApps = new InstanceElement('workspaceWithNoApps', workspaceType, {
      apps: [
        { id: 'b', position: 2 },
        { id: 'c', position: 3 },
        { id: referenceExpressionInWorkspaceApps, position: 1 },
        { id: 'a', position: 1 },
      ],
    })
    const referenceA = new ReferenceExpression(new ElemID('zendesk', 'test', 'instance', 'a'))
    const referenceB = new ReferenceExpression(new ElemID('zendesk', 'test', 'instance', 'b'))
    const referenceC = new ReferenceExpression(new ElemID('zendesk', 'test', 'instance', 'c'))
    const workspaceWithMacros = new InstanceElement('workspaceWithMacros', workspaceType, {
      macro_ids: [referenceC, 'd', referenceA, referenceB],
      selected_macros: [
        {
          id: referenceC,
        },
        {
          id: referenceA,
        },
        {
          id: 'd',
          restriction: {
            ids: [
              new ReferenceExpression(groupOneInstance.elemID, groupOneInstance),
              new ReferenceExpression(groupThreeInstance.elemID, groupThreeInstance),
              new ReferenceExpression(groupTwoInstance.elemID, groupTwoInstance),
            ],
          },
        },
        {
          id: referenceB,
        },
      ],
    })
    const invalidWorkspaceWithMacros = new InstanceElement('invalidWorkspaceWithMacros', workspaceType, {
      macro_ids: [referenceC, referenceA, referenceB],
      selected_macros: [
        {
          id: referenceC,
        },
        {},
        {
          id: referenceA,
        },
        {
          id: referenceB,
        },
      ],
    })

    const routingAttributeValueA = new InstanceElement('routingAttributeValueA', routingAttributeValueType, {
      name: 'A',
    })
    const routingAttributeValueB = new InstanceElement('routingAttributeValueB', routingAttributeValueType, {
      name: 'B',
    })
    const routingAttributeValueC = new InstanceElement('routingAttributeValueC', routingAttributeValueType, {
      name: 'C',
    })

    const routingAttribute = new InstanceElement('routingAttribute', routingAttributeType, {
      values: [
        new ReferenceExpression(routingAttributeValueC.elemID, routingAttributeValueC),
        new ReferenceExpression(routingAttributeValueA.elemID, routingAttributeValueA),
        new ReferenceExpression(routingAttributeValueB.elemID, routingAttributeValueB),
      ],
    })

    const empty = new InstanceElement('empty', dynamicContentItemType, {})
    return [
      localeType,
      localeEN,
      localeHE,
      localeES,
      dynamicContentItemType,
      withPopulatedRefs,
      withSomeUnpopulatedRefs,
      withSomeValues,
      empty,
      triggerDefinitionType,
      unsortedTriggerDefinitionInstance,
      enVariantInstance,
      esVariantInstance,
      heVariantInstance,
      enVariantNotPopulatedInstance,
      enVariantWithValuesInstance,
      withSomeUnpopulatedLocaleRefs,
      withSomeValuesForLocal,
      groupOneInstance,
      groupTwoInstance,
      groupThreeInstance,
      validMacroInstance,
      invalidMacroInstance1,
      invalidMacroInstance2,
      macroWithValuesInstance,
      validViewInstance,
      invalidViewInstance1,
      invalidViewInstance2,
      viewWithValuesInstance,
      validTicketFormInstance,
      customOneInstance,
      customThreeInstance,
      invalidTicketFormInstance,
      ticketFieldOneInstance,
      ticketFieldThreeInstance,
      invalidChildFieldTicketFormInstance,
      invalidTicketFieldInstance,
      workspaceWithMultipleApps,
      routingAttributeValueC,
      routingAttributeValueA,
      routingAttributeValueB,
      routingAttribute,
      workspaceWithMacros,
      invalidWorkspaceWithMacros,
    ]
  }

  let elements: Element[]

  beforeAll(async () => {
    filter = filterCreator(createFilterCreatorParams({})) as FilterType

    elements = generateElements()
    await filter.onFetch(elements)
  })

  describe('dynamic content item', () => {
    it('sort correctly when all references are populated', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'refs')
      expect(instances[0].value.variants).toHaveLength(3)
      expect(instances[0].value.variants[0].elemID.name).toEqual('en-variant')
      expect(instances[0].value.variants[1].elemID.name).toEqual('es-variant')
      expect(instances[0].value.variants[2].elemID.name).toEqual('he-variant')
    })
    it('sort correctly even when not all references are populated', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'missingRefs')
      expect(instances[0].value.variants).toHaveLength(3)
      expect(instances[0].value.variants[0].elemID.name).toEqual('en-variant')
      expect(instances[0].value.variants[1].elemID.name).toEqual('es-variant')
      expect(instances[0].value.variants[2].elemID.name).toEqual('he-variant')
    })
    it('not change order when not all values are references', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'vals')
      expect(instances[0].value.variants).toHaveLength(3)
      expect(instances[0].value.variants[0]).toEqual(123)
      expect(instances[0].value.variants[1].elemID.name).toEqual('he-variant')
      expect(instances[0].value.variants[2].elemID.name).toEqual('es-variant')
    })
    it('not change order when some all locale_id are values', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'valsLocal')
      expect(instances[0].value.variants).toHaveLength(3)
      expect(instances[0].value.variants[0].elemID.name).toEqual('en-variant no locale')
      expect(instances[0].value.variants[1].elemID.name).toEqual('he-variant')
      expect(instances[0].value.variants[2].elemID.name).toEqual('es-variant')
    })
    it('not change order when not all locale_id are populated', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'missingLocalRefs')
      expect(instances[0].value.variants).toHaveLength(3)
      expect(instances[0].value.variants[0].elemID.name).toEqual('en-variant not populated')
      expect(instances[0].value.variants[1].elemID.name).toEqual('he-variant')
      expect(instances[0].value.variants[2].elemID.name).toEqual('es-variant')
    })
    it('do nothing when instance structure is not as expected', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'empty')
      expect(instances[0].value).toEqual({})
    })
  })
  describe('macro and view restrictions', () => {
    it('sort correctly', async () => {
      const instances = elements
        .filter(isInstanceElement)
        .filter(e => ['valid macro', 'valid view'].includes(e.elemID.name))
      instances.forEach(instance => {
        expect(instance.value.restriction.ids).toHaveLength(3)
        expect(instance.value.restriction.ids[0].elemID.name).toEqual('groupA')
        expect(instance.value.restriction.ids[1].elemID.name).toEqual('groupB')
        expect(instance.value.restriction.ids[2].elemID.name).toEqual('groupC')
      })
    })
    it('not change order when some are values', async () => {
      const instances = elements
        .filter(isInstanceElement)
        .filter(e => ['values macro', 'values view'].includes(e.elemID.name))
      instances.forEach(instance => {
        expect(instance.value.restriction.ids).toHaveLength(3)
        expect(instance.value.restriction.ids[0]).toEqual(123)
        expect(instance.value.restriction.ids[1].elemID.name).toEqual('groupA')
        expect(instance.value.restriction.ids[2].elemID.name).toEqual('groupB')
      })
    })
    it('should do nothing when there is no restriction', async () => {
      const instances = elements
        .filter(isInstanceElement)
        .filter(e => ['invalid macro1', 'invalid view1'].includes(e.elemID.name))
      instances.forEach(instance => {
        expect(instance.value.restriction).not.toBeDefined()
      })
    })
    it('should do nothing when there is no ids', async () => {
      const instances = elements
        .filter(isInstanceElement)
        .filter(e => ['invalid macro2', 'invalid view2'].includes(e.elemID.name))
      instances.forEach(instance => {
        expect(instance.value.restriction.id).toEqual(123)
      })
    })
  })
  describe('ticket_form', () => {
    it('sort correctly', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'valid form')
      expect(instances[0].value.agent_conditions).toHaveLength(5)
      expect(instances[0].value.agent_conditions[0].parent_field_id.elemID.name).toEqual('customA')
      expect(instances[0].value.agent_conditions[1].parent_field_id.elemID.name).toEqual('customC')
      expect(instances[0].value.agent_conditions[2].value.elemID.name).toEqual('customA')
      expect(instances[0].value.agent_conditions[3].value).toEqual('b')
      expect(instances[0].value.agent_conditions[4].value.elemID.name).toEqual('customC')
      expect(instances[0].value.end_user_conditions).toHaveLength(3)
      expect(instances[0].value.end_user_conditions[0].value.elemID.name).toEqual('customA')
      expect(instances[0].value.end_user_conditions[1].value).toEqual('b')
      expect(instances[0].value.end_user_conditions[2].value.elemID.name).toEqual('customC')
      expect(instances[0].value.agent_conditions[2].child_fields).toHaveLength(2)
      expect(instances[0].value.agent_conditions[2].child_fields[0].id.elemID.name).toEqual('fieldA')
      expect(instances[0].value.agent_conditions[2].child_fields[1].id.elemID.name).toEqual('fieldC')
      expect(instances[0].value.end_user_conditions[0].child_fields).toHaveLength(2)
      expect(instances[0].value.end_user_conditions[0].child_fields[0].id.elemID.name).toEqual('fieldA')
      expect(instances[0].value.end_user_conditions[0].child_fields[1].id.elemID.name).toEqual('fieldC')
      expect(instances[0].value.restricted_brand_ids).toHaveLength(2)
      expect(instances[0].value.restricted_brand_ids[0].elemID.name).toEqual('heyBrand')
      expect(instances[0].value.restricted_brand_ids[1].elemID.name).toEqual('zzzBrand')
    })
    it('should not change order the form is invalid', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'invalid form')
      expect(instances[0].value.agent_conditions).toHaveLength(3)
      expect(instances[0].value.agent_conditions[0]).toEqual({})
      expect(instances[0].value.agent_conditions[1].value.elemID.name).toEqual('customA')
      expect(instances[0].value.agent_conditions[2].value).toEqual('b')
      expect(instances[0].value.end_user_conditions).toHaveLength(0)
    })
    it('should not change order the child_fields are invalid', async () => {
      const instances = elements.filter(isInstanceElement).filter(e => e.elemID.name === 'invalid child field form')
      expect(instances[0].value.agent_conditions[0].child_fields).toHaveLength(2)
      expect(instances[0].value.agent_conditions[0].child_fields[0].id).toEqual(123)
      expect(instances[0].value.agent_conditions[0].child_fields[1].id.elemID.name).toEqual('fieldA')
      expect(instances[0].value.agent_conditions[1].child_fields).toHaveLength(2)
      expect(instances[0].value.agent_conditions[1].child_fields[0].id.elemID.name).toEqual('invalid field')
      expect(instances[0].value.agent_conditions[1].child_fields[1].id.elemID.name).toEqual('fieldA')
    })
  })
  describe('trigger definition', () => {
    let instance: InstanceElement
    beforeAll(() => {
      ;[instance] = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === 'trigger_definition')
    })
    it('should sort actions by title and type', async () => {
      expect(instance.value.actions).toHaveLength(3)
      expect(instance.value.actions[0].title).toEqual('alpha')
      expect(instance.value.actions[0].type).toEqual('alpha')
      expect(instance.value.actions[1].title).toEqual('alpha')
      expect(instance.value.actions[1].type).toEqual('bravo')
      expect(instance.value.actions[2].title).toEqual('charlie')
      expect(instance.value.actions[2].type).toEqual('charlie')
    })
    it('should sort conditions_all by title and type', async () => {
      expect(instance.value.conditions_all).toHaveLength(3)
      expect(instance.value.conditions_all[0].title).toEqual('alpha')
      expect(instance.value.conditions_all[0].type).toEqual('alpha')
      expect(instance.value.conditions_all[1].title).toEqual('bravo')
      expect(instance.value.conditions_all[1].type).toEqual('bravo')
      expect(instance.value.conditions_all[2].title).toEqual('charlie')
      expect(instance.value.conditions_all[2].type).toEqual('bravo')
    })
    it('should sort conditions_any by title and type', async () => {
      expect(instance.value.conditions_any).toHaveLength(3)
      expect(instance.value.conditions_any[0].title).toEqual('bravo')
      expect(instance.value.conditions_any[0].type).toEqual('alpha')
      expect(instance.value.conditions_any[1].title).toEqual('bravo')
      expect(instance.value.conditions_any[1].type).toEqual('bravo')
      expect(instance.value.conditions_any[2].title).toEqual('charlie')
      expect(instance.value.conditions_any[2].type).toEqual('charlie')
    })
  })

  describe('view', () => {
    let view: InstanceElement
    beforeEach(() => {
      view = new InstanceElement('Test', new ObjectType({ elemID: new ElemID(ZENDESK, 'view') }), {
        execution: {
          custom_fields: [
            {
              id: 1,
              title: 'b',
              type: 'b',
            },
            {
              id: 2,
              title: 'b',
              type: 'a',
            },
            {
              id: 3,
              title: 'a',
              type: 'c',
            },
          ],
        },
      })
    })
    it('should reorder custom_fields by id', async () => {
      const testView = view.clone()
      await filter.onFetch([testView])
      expect(testView.value.execution.custom_fields).toEqual([
        {
          id: 3,
          title: 'a',
          type: 'c',
        },
        {
          id: 2,
          title: 'b',
          type: 'a',
        },
        {
          id: 1,
          title: 'b',
          type: 'b',
        },
      ])
    })
    it('should not crash when there are no execution or custom_fields', async () => {
      const testView = view.clone()
      const testView2 = view.clone()
      testView.value.execution = undefined
      testView2.value.execution.custom_fields = undefined
      await filter.onFetch([testView, testView2])
    })
  })
  describe('workspace', () => {
    let instance: InstanceElement
    let allWorkspaces: InstanceElement[]
    beforeAll(() => {
      allWorkspaces = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === WORKSPACE_TYPE_NAME)
    })

    it('should sort apps by position', async () => {
      ;[instance] = allWorkspaces.filter(e => e.elemID.name === 'workspaceWithNoApps')
      expect(instance.value.apps).toHaveLength(4)
      expect(instance.value.apps[0].position).toEqual(1)
      expect(instance.value.apps[0].id.elemID.getFullName()).toEqual('zendesk.d')
      expect(instance.value.apps[1].id).toEqual('a')
      expect(instance.value.apps[1].position).toEqual(1)
      expect(instance.value.apps[2].id).toEqual('b')
      expect(instance.value.apps[2].position).toEqual(2)
      expect(instance.value.apps[3].id).toEqual('c')
      expect(instance.value.apps[3].position).toEqual(3)
    })
    it('should sort macros ids correctly', async () => {
      ;[instance] = allWorkspaces.filter(e => e.elemID.name === 'workspaceWithMacros')
      expect(instance.value.macro_ids).toHaveLength(4)
      expect(instance.value.macro_ids[0]).toEqual('d')
      expect(instance.value.macro_ids[1].elemID.name).toEqual('a')
      expect(instance.value.macro_ids[2].elemID.name).toEqual('b')
      expect(instance.value.macro_ids[3].elemID.name).toEqual('c')
    })
    it('should sort selected macros correctly', async () => {
      ;[instance] = allWorkspaces.filter(e => e.elemID.name === 'workspaceWithMacros')
      expect(instance.value.selected_macros).toHaveLength(4)
      expect(instance.value.selected_macros[0].id).toEqual('d')
      expect(instance.value.selected_macros[1].id.elemID.name).toEqual('a')
      expect(instance.value.selected_macros[2].id.elemID.name).toEqual('b')
      expect(instance.value.selected_macros[3].id.elemID.name).toEqual('c')
    })
    it('should sort selected macros restrictions correctly', async () => {
      ;[instance] = allWorkspaces.filter(e => e.elemID.name === 'workspaceWithMacros')
      expect(instance.value.selected_macros).toHaveLength(4)
      expect(instance.value.selected_macros[0].id).toEqual('d')
      const restrictionIds = instance.value.selected_macros[0].restriction.ids
      expect(restrictionIds[0].elemID.name).toEqual('groupA')
      expect(restrictionIds[1].elemID.name).toEqual('groupB')
      expect(restrictionIds[2].elemID.name).toEqual('groupC')
    })
    it('should do nothing if selected macros is invalid', async () => {
      ;[instance] = allWorkspaces.filter(e => e.elemID.name === 'invalidWorkspaceWithMacros')
      expect(instance.value.selected_macros).toHaveLength(4)
      expect(instance.value.selected_macros[0].id.elemID.name).toEqual('c')
      expect(instance.value.selected_macros[1]).toEqual({})
      expect(instance.value.selected_macros[2].id.elemID.name).toEqual('a')
      expect(instance.value.selected_macros[3].id.elemID.name).toEqual('b')
    })
  })
  describe('routing attribute', () => {
    let instance: InstanceElement
    beforeAll(() => {
      ;[instance] = elements.filter(isInstanceElement).filter(e => e.elemID.typeName === ROUTING_ATTRIBUTE_TYPE_NAME)
    })

    it('should sort values by name', async () => {
      expect(instance.value.values).toHaveLength(3)
      expect(instance.value.values[0].value.value.name).toEqual('A')
      expect(instance.value.values[1].value.value.name).toEqual('B')
      expect(instance.value.values[2].value.value.name).toEqual('C')
    })
  })
})
