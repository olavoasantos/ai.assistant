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

  it('owns the root intent registry', () => {
    const application = new Application();

    expect(application.intents).toBeDefined();
    expect(application.intents.isEmpty).toBe(true);
  });
});
