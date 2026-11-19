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

/**
 * Logo horizontal para la pantalla de ingreso. Va como <img> y no incrustado: los SVG del manual
 * traen ids internos que chocarían con los de la página. Lleva sus dos variantes en el DOM y el CSS
 * deja ver la del tema (ver .solo-claro / .solo-oscuro): elegirla en React haría parpadear la clara
 * al recargar en oscuro, porque el tema se estampa antes de que React monte. En pantallas angostas
 * no cabe a su tamaño mínimo y se cambia por la marca compacta; el cambio lo hace el <picture>, el
 * tamaño lo pone el CSS.
 */
export function LogoEntrada() {
  return (
    <div className="ingreso-logo">
      <picture className="solo-claro">
        <source media="(max-width: 479px)" srcSet="/marca/marca.svg" width={545} height={757} />
        <img src="/marca/logo.svg" alt="INTECHSYS ONE" width={942} height={342} />
      </picture>
      <picture className="solo-oscuro">
        <source media="(max-width: 479px)" srcSet="/marca/marca-oscuro.svg" width={545} height={757} />
        <img src="/marca/logo-oscuro.svg" alt="INTECHSYS ONE" width={942} height={342} />
      </picture>
    </div>
  );
}
