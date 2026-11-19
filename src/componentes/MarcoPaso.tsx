import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';
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
 * Marco de las pantallas sin sesión (login, elegir empresa, entrar con One, errores al entrar), el
 * mismo de WorkLog: la marca centrada, una tarjeta con el título y el contenido, y el pie del
 * producto.
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

/** Aviso de error en la tarjeta, como el InlineMessage de WorkLog: ámbar, con el triángulo. */
export function AvisoPaso({ children }: { children: ReactNode }) {
  return (
    <div className="aviso-paso" role="alert">
      <AlertTriangle aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Paso en curso (conectando con One, entrando): el título dice qué pasa y abajo, la espera. */
export function PasoEnCurso({ titulo }: { titulo: string }) {
  return (
    <MarcoPaso titulo={titulo} ocupado>
      <div className="paso-espera" role="status">
        <LoaderCircle className="paso-girando" aria-hidden />
        Un momento, por favor.
      </div>
    </MarcoPaso>
  );
}
