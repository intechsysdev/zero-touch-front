import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronRight, LoaderCircle, LogOut } from 'lucide-react';
import { LogoEntrada } from './Marca';

/** Una empresa a la que el usuario llega por One. */
export type EmpresaElegible = {
  oneTenantId: string;
  nombre: string;
  /** Rol del usuario en la empresa en One (Owner, Admin, Member, Viewer). */
  rol?: string;
  slug?: string;
};

type Props = {
  producto: string;
  /** En el orden que da el API. */
  empresas: EmpresaElegible[];
  /** Mientras se abre la elegida: las demás no responden y la elegida muestra que carga. */
  ocupado: boolean;
  onElegir: (oneTenantId: string) => void;
  onSalir: () => void;
};

/** Los roles de One con los nombres que usa el portal. */
const ROLES_ONE: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  member: 'Miembro',
  viewer: 'Observador',
};

/** Segunda línea de cada empresa: el rol en One o, sin él, el slug para distinguirlas. */
function detalleEmpresa(empresa: EmpresaElegible): string | null {
  if (empresa.rol) return `Rol en ONE: ${ROLES_ONE[empresa.rol.toLowerCase()] ?? empresa.rol}`;
  return empresa.slug || null;
}

/**
 * Pantalla para elegir empresa al entrar con INTECHSYS ONE, cuando el usuario tiene varias y
 * ninguna vino indicada. Va dentro del marco del ingreso, sin menú: la consola no se abre (ni pide
 * nada de ninguna empresa) hasta elegir. Después se cambia desde el selector del menú.
 */
export function EleccionEmpresa({ producto, empresas, ocupado, onElegir, onSalir }: Props) {
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const [elegida, setElegida] = useState<string | null>(null);

  // El foco va al título para que el lector de pantalla anuncie la pantalla nueva.
  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  return (
    <>
      <section className="panel login-panel entrada-estrecha eleccion-empresa" aria-labelledby="eleccion-titulo">
        <div className="marca-entrada">
          <LogoEntrada />
        </div>

        <div className="eleccion-cabecera">
          <h1 id="eleccion-titulo" ref={tituloRef} tabIndex={-1} className="eleccion-titulo">
            ¿Con qué empresa vas a trabajar?
          </h1>
          <p className="eleccion-descripcion">
            Tienes acceso a {producto} en varias empresas. Puedes cambiarla luego desde el menú.
          </p>
        </div>

        <ul className="eleccion-lista" aria-busy={ocupado}>
          {empresas.map((empresa) => {
            const detalle = detalleEmpresa(empresa);
            const abriendo = ocupado && elegida === empresa.oneTenantId;
            return (
              <li key={empresa.oneTenantId}>
                <button
                  type="button"
                  className={abriendo ? 'eleccion-opcion abriendo' : 'eleccion-opcion'}
                  disabled={ocupado}
                  onClick={() => {
                    setElegida(empresa.oneTenantId);
                    onElegir(empresa.oneTenantId);
                  }}
                >
                  <span className="eleccion-icono" aria-hidden>
                    <Building2 />
                  </span>
                  <span className="eleccion-texto">
                    <span className="eleccion-nombre">{empresa.nombre}</span>
                    {detalle ? <span className="eleccion-detalle">{detalle}</span> : null}
                  </span>
                  {abriendo ? (
                    <LoaderCircle className="eleccion-flecha eleccion-cargando" aria-hidden />
                  ) : (
                    <ChevronRight className="eleccion-flecha" aria-hidden />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <button type="button" className="ghost-btn eleccion-salir" onClick={onSalir}>
          <LogOut aria-hidden />
          <span>Salir</span>
        </button>
      </section>

      <p className="eleccion-pie">INTECHSYS ONE · {producto}</p>
    </>
  );
}
