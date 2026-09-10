import { describe, expect, it } from 'vitest';

import { cn } from '../src/lib/cn';
import { errorMessage } from '../src/lib/errors';

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('a', false, undefined, 'b', null)).toBe('a b');
  });
});

describe('errorMessage', () => {
  it('translates known protocol codes to Spanish', () => {
    expect(errorMessage('NOT_YOUR_TURN')).toBe('No es tu turno.');
    expect(errorMessage('ROOM_FULL')).toBe('La sala ya está completa.');
  });

  it('falls back to the server message or a default', () => {
    expect(errorMessage('UNKNOWN_CODE', 'detalle')).toBe('detalle');
    expect(errorMessage('UNKNOWN_CODE')).toBe('Ha ocurrido un error.');
  });
});
