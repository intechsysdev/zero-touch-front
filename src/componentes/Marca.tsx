import { PRODUCTO } from '../producto';

/**
 * Marca del producto, la misma de WorkLog: isotipo + "one" + separador + nombre y descripción.
 * La variante compacta deja solo el isotipo y "one". El "one" es texto (no imagen): toma su color
 * del tema con --wordmark y no necesita una variante por tema.
 */
export function MarcaProducto({ className, compacta }: { className?: string; compacta?: boolean }) {
  return (
    <div className={className ? `marca-producto ${className}` : 'marca-producto'}>
      <div role="img" aria-label="INTECHSYS ONE" className="marca-producto-one">
        <img src="/favicon.svg" alt="" width={30} height={31} />
        <span aria-hidden>one</span>
      </div>
      {!compacta && (
        <>
          <span aria-hidden className="marca-producto-separador" />
          <span className="marca-producto-texto">
            <span className="marca-producto-nombre">{PRODUCTO.nombre}</span>
            <span className="marca-producto-descripcion">{PRODUCTO.descripcion}</span>
          </span>
        </>
      )}
    </div>
  );
}
