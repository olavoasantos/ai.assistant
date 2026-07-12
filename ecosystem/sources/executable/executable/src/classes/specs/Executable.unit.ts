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

  it('settles static factories at their named lifecycle states', async () => {
    await expect(Executable.create()).resolves.toMatchObject({status: 'initialized'});
    await expect(Executable.activate()).resolves.toMatchObject({status: 'active'});
  });

  it('invokes the kernel but never invokes inherited plugins automatically', async () => {
    const providerCreate = vi.fn();
    const kernelCreate = vi.fn();
    const executable = new Executable({
      plugins: [plugin('provider', {create: providerCreate})],
      kernel: plugin('kernel', {create: kernelCreate}),
    });

    await executable.initialize();

    expect(providerCreate).not.toHaveBeenCalled();
    expect(kernelCreate).toHaveBeenCalledOnce();
  });

  it('lets specialization callbacks select inherited plugin hooks', async () => {
    const providerCreate = vi.fn();
    const executable = new Executable({
      plugins: [plugin('provider', {create: providerCreate})],
      lifecycles: {
        async create() {
          await this.pluginContainer.parallel({hook: 'create', args: []});
        },
      },
    });

    await executable.initialize();

    expect(providerCreate).toHaveBeenCalledOnce();
  });

  it('injects the scope container into kernel contexts', async () => {
    const contexts: unknown[] = [];
    const executable = new Executable({
      kernel: plugin('kernel', {
        create() {
          contexts.push(this.container);
        },
      }),
    });

    await executable.initialize();

    expect(contexts).toEqual([executable.container]);
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
