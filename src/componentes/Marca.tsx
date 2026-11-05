/**
 * Logos de INTECHSYS ONE. Van como <img> y no incrustados: los SVG del manual traen ids internos
 * que chocarían con los de la página. Cada logo lleva sus dos variantes en el DOM y el CSS deja
 * ver la del tema (ver .solo-claro / .solo-oscuro): elegirla en React haría parpadear la clara
 * al recargar en oscuro, porque el tema se estampa antes de que React monte.
 */

/** Marca compacta (isotipo + "one") para cabeceras. El nombre del producto va al lado, como texto. */
export function MarcaCompacta() {
  return (
    <span className="marca-logo">
      <img className="solo-claro" src="/marca/marca.svg" alt="INTECHSYS ONE" width={545} height={757} />
      <img className="solo-oscuro" src="/marca/marca-oscuro.svg" alt="INTECHSYS ONE" width={545} height={757} />
    </span>
  );
}

/**
 * Logo horizontal para la pantalla de entrada. En pantallas angostas no cabe a su tamaño mínimo
 * y se cambia por la marca compacta; el cambio lo hace el <picture>, el tamaño lo pone el CSS.
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

