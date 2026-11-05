import { useTema } from '../tema/TemaContexto';
import type { Tema } from '../tema/TemaContexto';

const OPCIONES: { valor: Tema; titulo: string; icono: React.ReactNode }[] = [
  {
    valor: 'sistema',
    titulo: 'Seguir el sistema',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  {
    valor: 'claro',
    titulo: 'Modo claro',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" />
      </svg>
    ),
  },
  {
    valor: 'oscuro',
    titulo: 'Modo oscuro',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.5 14.6A8.6 8.6 0 019.4 3.5a8.6 8.6 0 1011.1 11.1z" />
      </svg>
    ),
  },
];

export function SelectorTema() {
  const { tema, elegir } = useTema();

  return (
    <div className="tema" role="group" aria-label="Tema de la interfaz">
      {OPCIONES.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          title={opcion.titulo}
          aria-label={opcion.titulo}
          aria-pressed={tema === opcion.valor}
          onClick={() => elegir(opcion.valor)}
        >
          {opcion.icono}
        </button>
      ))}
    </div>
  );
}

