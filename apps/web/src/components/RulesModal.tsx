import { RULES } from '@flota/domain';

export function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-sea-700 bg-sea-900 p-5">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-mint">Cómo jugar</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-ink"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className="space-y-3 text-sm leading-relaxed text-ink">
          <p>
            Cada jugador elige <strong>3 barcos</strong> de clases distintas con un presupuesto de{' '}
            <strong>{RULES.budget} puntos</strong> y los coloca en un tablero de {RULES.size}×
            {RULES.size}.
          </p>
          <p>
            En tu turno dispones de <strong>{RULES.actions} acciones</strong>. Cada barco puede
            moverse, atacar y usar su habilidad una vez por turno.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Cañón:</strong> golpea una sola casilla.
            </li>
            <li>
              <strong>Torpedo:</strong> golpea hasta tres casillas en línea (derecha o abajo).
            </li>
            <li>
              <strong>Sonar:</strong> revela un área de 3×3 durante tu turno.
            </li>
            <li>
              <strong>Camuflaje:</strong> oculta el barco al sonar; atacar lo desvela.
            </li>
            <li>
              <strong>Reparación:</strong> recupera PV, dentro del máximo del barco.
            </li>
          </ul>
          <p>
            Un impacto por barco y ataque, aunque el arma cubra varias de sus casillas. Gana quien
            hunda los 3 barcos del rival. La revancha requiere que ambos la acepten.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg bg-mint px-4 py-2 font-semibold text-sea-950 hover:brightness-110"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
