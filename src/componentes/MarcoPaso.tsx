import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { PRODUCTO } from '../producto';
import { MarcaProducto } from './Marca';

type Props = {
  titulo: string;
  descripcion?: ReactNode;
  /** Avisos de error o de éxito: van en la tarjeta, bajo el título. */
  aviso?: ReactNode;
  /** Lleva el foco al título al mostrarse, para que el lector de pantalla anuncie la pantalla. */
  enfocarTitulo?: boolean;
  ocupado?: boolean;
  children: ReactNode;
};

/**
 * Marco de las pantallas de paso sin sesión (elegir empresa, abriendo la consola), el mismo de
 * WorkLog: la marca centrada, una tarjeta con el título y el contenido, y el pie del producto.
 * El ingreso por Client ID tiene su propio diseño y no pasa por aquí.
 */
export function MarcoPaso({ titulo, descripcion, aviso, enfocarTitulo, ocupado, children }: Props) {
  const tituloRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (enfocarTitulo) tituloRef.current?.focus();
  }, [enfocarTitulo]);

  return (
    <main className="marco-paso">
      <div className="paso-columna">
        <MarcaProducto className="paso-marca" />
        <section className="paso-tarjeta" aria-labelledby="paso-titulo" aria-busy={ocupado || undefined}>
          <div className="paso-cabecera">
            <h1 id="paso-titulo" ref={tituloRef} tabIndex={enfocarTitulo ? -1 : undefined} className="paso-titulo">
              {titulo}
            </h1>
            {descripcion ? <p className="paso-descripcion">{descripcion}</p> : null}
          </div>
          {aviso}
          {children}
        </section>
        <p className="paso-pie">INTECHSYS ONE · {PRODUCTO.nombre}</p>
      </div>
    </main>
  );
}
