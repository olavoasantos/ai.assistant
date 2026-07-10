import {describe, expect, it} from 'vitest';
import {Telemetry} from '../../classes/Telemetry';
import {TELEMETRY_IDENTIFIER} from '../../constants';
import {TelemetryGuard} from '../TelemetryGuard';

describe('TelemetryGuard', () => {
  it('should accept a Telemetry instance', () => {
    const telemetry = new Telemetry({namespace: 'app'});

    expect(TelemetryGuard.is(telemetry)).toBe(true);
  });

  it('should reject null', () => {
    expect(TelemetryGuard.is(null)).toBe(false);
  });

  it('should reject undefined', () => {
    expect(TelemetryGuard.is(undefined)).toBe(false);
  });

  it('should reject a plain object', () => {
    expect(TelemetryGuard.is({namespace: 'app'})).toBe(false);
  });

  it('should reject a number', () => {
    expect(TelemetryGuard.is(42)).toBe(false);
  });

  it('should reject a string', () => {
    expect(TelemetryGuard.is('telemetry')).toBe(false);
  });

  it('should accept an object with the correct brand symbol', () => {
    const branded = {[TELEMETRY_IDENTIFIER]: true};

    expect(TelemetryGuard.is(branded)).toBe(true);
  });

  it('should reject an object with the brand symbol set to false', () => {
    const branded = {[TELEMETRY_IDENTIFIER]: false};

    expect(TelemetryGuard.is(branded)).toBe(false);
  });
});
