import type {
  Activity,
  IntentDefinition,
  IntentInvokeOptions,
} from '@ai.assistant/contracts/intents';
import type {Intent as IntentContract} from '@ai.assistant/contracts/intents';
import {describe, expect, it, vi} from 'vitest';
import {INTENT_ACTIVITIES, INTENT_IDENTIFIER} from '../../constants';
import {Intent} from '../Intent';

/**
 * Creates a minimal intent definition for testing.
 *
 * @param overrides - Fields to override on the default definition.
 * @returns A complete intent definition.
 */
function createDefinition(overrides: Partial<IntentDefinition> = {}): IntentDefinition {
  return {
    action: 'create',
    mimeType: 'application/vnd.ai.assistant.thing',
    scope: 'main',
    kernel: 'default',
    handler: vi.fn(),
    ...overrides,
  };
}

/**
 * Creates a mock registry invoke callback.
 *
 * @returns A mock function matching the invoke callback signature.
 */
function createMockRegistry() {
  return vi.fn<
    (intent: IntentContract<any, any>, options?: IntentInvokeOptions) => Promise<Activity>
  >();
}

describe('Intent', () => {
  describe('construction', () => {
    it('should create with all required fields', () => {
      const handler = vi.fn();
      const registry = createMockRegistry();
      const intent = new Intent(
        {
          action: 'navigate',
          mimeType: 'application/vnd.ai.assistant.page',
          scope: 'main',
          kernel: 'browser',
          handler,
        },
        registry,
      );

      expect(intent.action).toBe('navigate');
      expect(intent.mimeType).toBe('application/vnd.ai.assistant.page');
      expect(intent.scope).toBe('main');
      expect(intent.kernel).toBe('browser');
      expect(intent.handler).toBe(handler);
    });

    it('should default vendor to empty string', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      expect(intent.vendor).toBe('');
    });

    it('should default name to undefined', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      expect(intent.name).toBeUndefined();
    });

    it('should default description to undefined', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      expect(intent.description).toBeUndefined();
    });

    it('should default mode to awaitable', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      expect(intent.mode).toBe('awaitable');
    });

    it('should default priority to 0', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      expect(intent.priority).toBe(0);
    });

    it('should default metadata to empty object', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      expect(intent.metadata).toEqual({});
    });

    it('should have the Intent brand symbol', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      expect(intent[INTENT_IDENTIFIER]).toBe(true);
    });
  });

  describe('identity immutability', () => {
    it('should expose action as readonly', () => {
      const intent = new Intent(createDefinition({action: 'create'}), createMockRegistry());

      expect(intent.action).toBe('create');
      expect(Object.getOwnPropertyDescriptor(Intent.prototype, 'action')).toMatchObject({
        set: undefined,
      });
    });

    it('should expose mimeType as readonly', () => {
      const intent = new Intent(
        createDefinition({mimeType: 'application/vnd.ai.assistant.thing'}),
        createMockRegistry(),
      );

      expect(intent.mimeType).toBe('application/vnd.ai.assistant.thing');
      expect(Object.getOwnPropertyDescriptor(Intent.prototype, 'mimeType')).toMatchObject({
        set: undefined,
      });
    });

    it('should expose scope as readonly', () => {
      const intent = new Intent(createDefinition({scope: 'main'}), createMockRegistry());

      expect(intent.scope).toBe('main');
      expect(Object.getOwnPropertyDescriptor(Intent.prototype, 'scope')).toMatchObject({
        set: undefined,
      });
    });

    it('should expose kernel as readonly', () => {
      const intent = new Intent(createDefinition({kernel: 'default'}), createMockRegistry());

      expect(intent.kernel).toBe('default');
      expect(Object.getOwnPropertyDescriptor(Intent.prototype, 'kernel')).toMatchObject({
        set: undefined,
      });
    });

    it('should expose vendor as readonly', () => {
      const intent = new Intent(createDefinition({vendor: 'acme'}), createMockRegistry());

      expect(intent.vendor).toBe('acme');
      expect(Object.getOwnPropertyDescriptor(Intent.prototype, 'vendor')).toMatchObject({
        set: undefined,
      });
    });
  });

  describe('setMany()', () => {
    it('should update name', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      intent.setMany({name: 'Create Thing'});

      expect(intent.name).toBe('Create Thing');
    });

    it('should update description', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      intent.setMany({description: 'Creates a new thing'});

      expect(intent.description).toBe('Creates a new thing');
    });

    it('should shallow-merge metadata', () => {
      const intent = new Intent(createDefinition({metadata: {a: 1, b: 2}}), createMockRegistry());

      intent.setMany({metadata: {b: 3, c: 4}});

      expect(intent.metadata).toEqual({a: 1, b: 3, c: 4});
    });

    it('should update mode', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      intent.setMany({mode: 'streaming'});

      expect(intent.mode).toBe('streaming');
    });

    it('should update priority', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      intent.setMany({priority: 10});

      expect(intent.priority).toBe(10);
    });

    it('should update handler', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());
      const newHandler = vi.fn();

      intent.setMany({handler: newHandler});

      expect(intent.handler).toBe(newHandler);
    });

    it('should return this for chaining', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      const result = intent.setMany({name: 'Test'});

      expect(result).toBe(intent);
    });

    it('should not update action', () => {
      const intent = new Intent(createDefinition({action: 'create'}), createMockRegistry());

      intent.setMany({action: 'navigate'} as any);

      expect(intent.action).toBe('create');
    });

    it('should not update mimeType', () => {
      const intent = new Intent(
        createDefinition({mimeType: 'application/vnd.ai.assistant.thing'}),
        createMockRegistry(),
      );

      intent.setMany({mimeType: 'application/vnd.ai.assistant.other'} as any);

      expect(intent.mimeType).toBe('application/vnd.ai.assistant.thing');
    });

    it('should not update scope', () => {
      const intent = new Intent(createDefinition({scope: 'main'}), createMockRegistry());

      intent.setMany({scope: 'overlay'} as any);

      expect(intent.scope).toBe('main');
    });

    it('should not update kernel', () => {
      const intent = new Intent(createDefinition({kernel: 'default'}), createMockRegistry());

      intent.setMany({kernel: 'custom'} as any);

      expect(intent.kernel).toBe('default');
    });

    it('should not update vendor', () => {
      const intent = new Intent(createDefinition({vendor: 'acme'}), createMockRegistry());

      intent.setMany({vendor: 'other'} as any);

      expect(intent.vendor).toBe('acme');
    });
  });

  describe('toJSON()', () => {
    it('should include identity fields', () => {
      const intent = new Intent(
        createDefinition({
          action: 'create',
          mimeType: 'application/vnd.ai.assistant.thing',
          scope: 'main',
          kernel: 'default',
          vendor: 'acme',
        }),
        createMockRegistry(),
      );

      const json = intent.toJSON();

      expect(json.action).toBe('create');
      expect(json.mimeType).toBe('application/vnd.ai.assistant.thing');
      expect(json.scope).toBe('main');
      expect(json.kernel).toBe('default');
      expect(json.vendor).toBe('acme');
    });

    it('should include mutable serializable fields', () => {
      const intent = new Intent(
        createDefinition({
          name: 'Create Thing',
          description: 'Creates a thing',
          mode: 'streaming',
          priority: 5,
        }),
        createMockRegistry(),
      );

      const json = intent.toJSON();

      expect(json.name).toBe('Create Thing');
      expect(json.description).toBe('Creates a thing');
      expect(json.mode).toBe('streaming');
      expect(json.priority).toBe(5);
    });

    it('should omit handler', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      const json = intent.toJSON();

      expect(json).not.toHaveProperty('handler');
    });

    it('should omit inputSchema', () => {
      const intent = new Intent(
        createDefinition({inputSchema: {ensureParse: vi.fn()} as any}),
        createMockRegistry(),
      );

      const json = intent.toJSON();

      expect(json).not.toHaveProperty('inputSchema');
    });

    it('should omit outputSchema', () => {
      const intent = new Intent(
        createDefinition({outputSchema: {ensureParse: vi.fn()} as any}),
        createMockRegistry(),
      );

      const json = intent.toJSON();

      expect(json).not.toHaveProperty('outputSchema');
    });

    it('should include metadata', () => {
      const intent = new Intent(
        createDefinition({metadata: {category: 'admin'}}),
        createMockRegistry(),
      );

      const json = intent.toJSON();

      expect(json.metadata).toEqual({category: 'admin'});
    });
  });

  describe('activities', () => {
    it('should be initially empty', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      expect(intent.activities).toEqual([]);
    });

    it('should expose the internal activities signal for registry management', () => {
      const intent = new Intent(createDefinition(), createMockRegistry());

      expect(intent[INTENT_ACTIVITIES]).toBeDefined();
      expect(intent[INTENT_ACTIVITIES].value).toEqual([]);
    });
  });

  describe('invoke()', () => {
    it('should delegate to the registry callback', async () => {
      const mockActivity = {id: 'activity-1'} as unknown as Activity;
      const registry = createMockRegistry();
      registry.mockResolvedValue(mockActivity);
      const intent = new Intent(createDefinition(), registry);

      const result = await intent.invoke({input: {name: 'test'}});

      expect(registry).toHaveBeenCalledWith(intent, {input: {name: 'test'}});
      expect(result).toBe(mockActivity);
    });

    it('should delegate without options when none provided', async () => {
      const mockActivity = {id: 'activity-1'} as unknown as Activity;
      const registry = createMockRegistry();
      registry.mockResolvedValue(mockActivity);
      const intent = new Intent(createDefinition(), registry);

      await intent.invoke();

      expect(registry).toHaveBeenCalledWith(intent, undefined);
    });
  });
});
