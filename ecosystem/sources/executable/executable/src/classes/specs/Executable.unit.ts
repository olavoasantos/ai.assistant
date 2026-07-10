import type {KernelLifecycles} from '@ai.assistant/contracts/executable';
import type {Plugin} from '@ai.assistant/contracts/plugins';
import {describe, expect, it, vi} from 'vitest';
import {Executable} from '../Executable';

function plugin(
  name: string,
  hooks: Partial<Plugin<KernelLifecycles>> = {},
): Plugin<KernelLifecycles> {
  return {name, ...hooks};
}

describe('Executable', () => {
  it('constructs inert infrastructure at created state', () => {
    const create = vi.fn();
    const executable = new Executable({lifecycles: {create}});

    expect(executable.status).toBe('created');
    expect(executable.scope).toBe('executable');
    expect(executable.error).toBeNull();
    expect(executable.container).toBeDefined();
    expect(executable.pluginContainer).toBeDefined();
    expect(executable.telemetry).toBeDefined();
    expect(create).not.toHaveBeenCalled();
  });

  it('static factories settle at their named lifecycle states', async () => {
    await expect(Executable.create()).resolves.toMatchObject({status: 'initialized'});
    await expect(Executable.activate()).resolves.toMatchObject({status: 'active'});
  });

  it('preserves subclasses through factories and forks', async () => {
    class SpecializedExecutable extends Executable {}

    const root = await SpecializedExecutable.create();
    const child = root.fork();

    expect(root).toBeInstanceOf(SpecializedExecutable);
    expect(child).toBeInstanceOf(SpecializedExecutable);
  });

  it('injects the scope container into plugin and kernel contexts', async () => {
    const contexts: unknown[] = [];
    const executable = new Executable({
      plugins: [
        plugin('provider', {
          create() {
            contexts.push(this.container);
          },
        }),
      ],
      kernel: plugin('kernel', {
        create() {
          contexts.push(this.container);
        },
      }),
    });

    await executable.initialize();

    expect(contexts).toEqual([executable.container, executable.container]);
  });

  it('continues owned cleanup after a disposal callback fails', async () => {
    const executable = new Executable({
      lifecycles: {
        dispose() {
          throw new Error('lifecycle cleanup failed');
        },
      },
    });
    const containerDispose = vi.spyOn(executable.container, 'dispose');

    await expect(executable.dispose()).rejects.toThrow('lifecycle cleanup failed');

    expect(containerDispose).toHaveBeenCalledOnce();
    expect(executable.status).toBe('error');
  });
});
