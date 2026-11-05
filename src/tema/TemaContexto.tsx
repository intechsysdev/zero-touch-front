import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Tres estados, no dos. "sistema" no es un valor intermedio decorativo: es el ajuste que trae
 * casi todo el mundo, y significa no estampar nada en la raíz para que mande
 * prefers-color-scheme. Elegir claro u oscuro estampa data-theme y le gana al sistema.
 */
export type Tema = 'sistema' | 'claro' | 'oscuro';

const CLAVE = 'zerotouch.tema';

interface Contexto {
  tema: Tema;
  elegir: (tema: Tema) => void;
}

const TemaContexto = createContext<Contexto | null>(null);

function estampar(tema: Tema) {
  const raiz = document.documentElement;

  if (tema === 'sistema') {
    delete raiz.dataset.theme;
  } else {
    raiz.dataset.theme = tema === 'claro' ? 'light' : 'dark';
  }
}

export function ProveedorTema({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(() => {
    try {
      const guardado = localStorage.getItem(CLAVE);
      return guardado === 'claro' || guardado === 'oscuro' ? guardado : 'sistema';
    } catch {
      return 'sistema';
    }
  });

  const elegir = useCallback((nuevo: Tema) => {
    setTema(nuevo);
    estampar(nuevo);

    try {
      if (nuevo === 'sistema') localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, nuevo);
    } catch {
      /* sin localStorage la elección dura lo que la pestaña */
    }
  }, []);

  // El index.html ya estampó el tema antes de pintar; esto solo cubre el caso de que React
  // monte con un valor distinto al que quedó en el atributo.
  useEffect(() => estampar(tema), [tema]);

  const valor = useMemo<Contexto>(() => ({ tema, elegir }), [tema, elegir]);

  return <TemaContexto.Provider value={valor}>{children}</TemaContexto.Provider>;
}

export function useTema(): Contexto {
  const contexto = useContext(TemaContexto);
  if (!contexto) throw new Error('useTema debe usarse dentro de ProveedorTema.');
  return contexto;
}

