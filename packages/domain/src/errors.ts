/** Machine-readable domain error codes, shared with the protocol layer. */
export type DomainErrorCode =
  | 'INVALID_SELECTION'
  | 'INVALID_PLACEMENT'
  | 'OVERLAP'
  | 'GAME_NOT_ACTIVE'
  | 'GAME_FINISHED'
  | 'ALREADY_READY'
  | 'NOT_YOUR_TURN'
  | 'NO_ACTIONS_LEFT'
  | 'SHIP_NOT_FOUND'
  | 'SHIP_SUNK'
  | 'ACTION_ALREADY_USED'
  | 'INVALID_MOVE'
  | 'INVALID_TARGET'
  | 'ABILITY_UNAVAILABLE'
  | 'NO_CHARGES'
  | 'ON_COOLDOWN'
  | 'INVALID_ALLY'
  | 'REMATCH_NOT_ALLOWED';

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
