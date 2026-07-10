import {describe, expect, it} from 'vitest';
import {SERVICE_CONTAINER_IDENTIFIER} from '../../constants';
import {ServiceContainer} from '../../classes/ServiceContainer';
import {ServiceContainerGuard} from '../ServiceContainerGuard';

describe('ServiceContainerGuard', () => {
  it('returns Ok for a ServiceContainer instance', () => {
    const container = new ServiceContainer();
    const result = ServiceContainerGuard.validate(container);

    expect(result.ok).toBe(true);
  });

  it('narrows via .is() type predicate', () => {
    const container = new ServiceContainer();

    expect(ServiceContainerGuard.is(container)).toBe(true);
  });

  it('returns Err for null', () => {
    const result = ServiceContainerGuard.validate(null);

    expect(result.ok).toBe(false);
  });

  it('returns Err for undefined', () => {
    const result = ServiceContainerGuard.validate(undefined);

    expect(result.ok).toBe(false);
  });

  it('returns Err for a plain object without brand', () => {
    const result = ServiceContainerGuard.validate({ensure: () => {}, get: () => {}});

    expect(result.ok).toBe(false);
  });

  it('returns Ok for an object with the brand symbol set to true', () => {
    const fake = {[SERVICE_CONTAINER_IDENTIFIER]: true};
    const result = ServiceContainerGuard.validate(fake);

    expect(result.ok).toBe(true);
  });

  it('returns Err for an object with the brand symbol set to false', () => {
    const fake = {[SERVICE_CONTAINER_IDENTIFIER]: false};
    const result = ServiceContainerGuard.validate(fake);

    expect(result.ok).toBe(false);
  });

  it('returns Err for a primitive value', () => {
    expect(ServiceContainerGuard.is(42)).toBe(false);
    expect(ServiceContainerGuard.is('string')).toBe(false);
    expect(ServiceContainerGuard.is(true)).toBe(false);
  });
});
