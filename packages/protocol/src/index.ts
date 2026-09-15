export { ApiError, Envelope, ERROR_CODES, ErrorCode, PROTOCOL_VERSION } from './common.js';

export {
  AuthResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
  RegisterRequest,
  ResetPasswordRequest,
  TokenResponse,
  UpdateProfileRequest,
  UserProfile,
} from './auth.js';

export {
  ActionResult,
  Axis,
  Cell,
  Command,
  EnemyShip,
  OwnShip,
  Phase,
  Placement,
  PlayerView,
  Role,
  ShipId,
} from './game.js';

export { ClientMessage, ServerMessage } from './messages.js';
export type { ClientMessageType, ServerMessageType } from './messages.js';

export {
  AdminGameEvent,
  AdminGameEventsResponse,
  AdminMatch,
  AdminMatchPlayer,
  AdminMatchesResponse,
} from './admin.js';
export type {
  AdminGameEvent as AdminGameEventType,
  AdminGameEventsResponse as AdminGameEventsResponseType,
  AdminMatch as AdminMatchType,
  AdminMatchPlayer as AdminMatchPlayerType,
  AdminMatchesResponse as AdminMatchesResponseType,
} from './admin.js';
