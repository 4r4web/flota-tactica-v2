import { useGame } from '../store/game';

export function ErrorToast() {
  const error = useGame((state) => state.error);
  const clearError = useGame((state) => state.clearError);

  if (error === null) {
    return null;
  }

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border border-coral/60 bg-sea-800 px-4 py-3 text-sm text-ink shadow-lg"
    >
      <span>{error}</span>
      <button
        type="button"
        onClick={clearError}
        className="text-coral hover:text-ink"
        aria-label="Cerrar aviso"
      >
        ✕
      </button>
    </div>
  );
}
