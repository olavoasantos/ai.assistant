import {describe, expect, it, vi} from 'vitest';
import {PluginDirectExecutor} from '../PluginDirectExecutor';

interface TestHook {
  (value: string): string | void;
}

function createEntry(values: Array<string | undefined>): any {
  return {
    invocation: {},
    runner: {
      invokePreparedSync: vi.fn(() => ({recovered: false, value: values.shift()})),
    },
  };
}

describe('PluginDirectExecutor', () => {
  it('executes prepared entries sequentially', () => {
    const first = createEntry(['first']);
    const second = createEntry(['second']);
    const executor = new PluginDirectExecutor<TestHook>([first, second]);

    executor.sequential(['input']);

    expect(first.runner.invokePreparedSync).toHaveBeenCalledTimes(1);
    expect(second.runner.invokePreparedSync).toHaveBeenCalledTimes(1);
  });

  it('returns the first non-null prepared result', () => {
    const skipped = createEntry(['skipped']);
    const executor = new PluginDirectExecutor<TestHook>([
      createEntry([undefined]),
      createEntry(['matched']),
      skipped,
    ]);

    expect(executor.first(['input'])).toBe('matched');
    expect(skipped.runner.invokePreparedSync).not.toHaveBeenCalled();
  });

  it('reduces defined prepared results', () => {
    const executor = new PluginDirectExecutor<TestHook>([
      createEntry(['one']),
      createEntry([undefined]),
      createEntry(['two']),
    ]);

    const result = executor.reduce({
      args: ['input'],
      initial: [] as string[],
      reduce: (accumulator, value) => [...accumulator, value ?? ''],
    });

    expect(result).toEqual(['one', 'two']);
  });

  it('becomes unusable after close', () => {
    const executor = new PluginDirectExecutor<TestHook>([]);

    executor.close();

    expect(() => executor.sequential(['input'])).toThrow(
      'Cannot use a plugin direct executor outside its execution scope.',
    );
  });
});
