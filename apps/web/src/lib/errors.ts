const MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Necesitas iniciar sesión.',
  AUTH_INVALID: 'Credenciales incorrectas.',
  TOKEN_EXPIRED: 'La sesión ha caducado. Vuelve a iniciar sesión.',
  EMAIL_TAKEN: 'Ese correo ya está registrado.',
  RATE_LIMITED: 'Demasiados intentos. Espera un momento.',
  ROOM_NOT_FOUND: 'No existe ninguna sala con ese código.',
  ROOM_FULL: 'La sala ya está completa.',
  NOT_YOUR_TURN: 'No es tu turno.',
  INVALID_ACTION: 'Esa acción no es válida.',
  STALE_EPOCH: 'La partida ha cambiado. Vuelve a sincronizar.',
  SEQ_MISMATCH: 'Desincronización con el servidor.',
  MESSAGE_TOO_LARGE: 'El mensaje es demasiado grande.',
  GAME_FINISHED: 'La partida ya ha terminado.',
  INTERNAL: 'Error interno del servidor.',
};

export function errorMessage(code: string, fallback?: string): string {
  return MESSAGES[code] ?? fallback ?? 'Ha ocurrido un error.';
}
