import {describe, expect, it, vi} from 'vitest';
import {Application} from '../Application';

describe('Application', () => {
  it('creates an initialized Application through the static factory', async () => {
    const application = await Application.create();

    expect(application).toBeInstanceOf(Application);
    expect(application.status).toBe('initialized');
  });

  it('creates an active Application through the static factory', async () => {
    const activate = vi.fn();
    const application = await Application.activate({
      serviceProviders: [{name: 'provider', activate}],
    });

    expect(application).toBeInstanceOf(Application);
    expect(application.status).toBe('active');
    expect(activate).toHaveBeenCalledOnce();
  });

  it('preserves the Application subtype when forking', () => {
    const parent = new Application();

    const child = parent.fork();

    expect(child).toBeInstanceOf(Application);
    expect(child.scope).toBe('child');
  });
});
