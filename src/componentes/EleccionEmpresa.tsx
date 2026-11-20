import { useState } from 'react';
import type { ReactNode } from 'react';
import { Building2, ChevronRight, LoaderCircle, LogOut } from 'lucide-react';
import { PRODUCTO } from '../producto';
import { MarcoPaso } from './MarcoPaso';
import { nombreRol } from '../roles';

/** Una empresa a la que el usuario llega por One. */
export type EmpresaElegible = {
  oneTenantId: string;
  nombre: string;
  /** Rol del usuario en la empresa en One (Owner, Admin, Member, Viewer). */
  rol?: string;
  slug?: string;
};

type Props = {
  /** En el orden que da el API. */
  empresas: EmpresaElegible[];
  /** Mientras se abre la elegida: las demás no responden y la elegida muestra que carga. */
  ocupado: boolean;
  /** Si la elegida no se pudo abrir, el aviso sale aquí mismo y se puede elegir otra. */
  aviso?: ReactNode;
  onElegir: (oneTenantId: string) => void;
  onSalir: () => void;
};

/** Segunda línea de cada empresa: el rol en One o, sin él, el slug para distinguirlas. */
function detalleEmpresa(empresa: EmpresaElegible): string | null {
  if (empresa.rol) return `Rol en ONE: ${nombreRol(empresa.rol)}`;
  return empresa.slug || null;
}

/**
 * Pantalla para elegir empresa al entrar con INTECHSYS ONE, cuando el usuario tiene varias y
 * ninguna vino indicada. Es la de WorkLog, sin menú: la consola no se abre (ni pide nada de
 * ninguna empresa) hasta elegir. Después se cambia desde el menú de la cuenta.
 */
export function EleccionEmpresa({ empresas, ocupado, aviso, onElegir, onSalir }: Props) {
  const [elegida, setElegida] = useState<string | null>(null);

  return (
    <MarcoPaso
      titulo="¿Con qué empresa vas a trabajar?"
      descripcion={`Tienes acceso a ${PRODUCTO.nombre} en varias empresas. Puedes cambiar luego desde tu menú.`}
      aviso={aviso}
      enfocarTitulo
    >
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
                  <LoaderCircle className="eleccion-flecha paso-girando" aria-hidden />
                ) : (
                  <ChevronRight className="eleccion-flecha" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <button type="button" className="paso-boton-fantasma eleccion-salir" onClick={onSalir}>
        <LogOut aria-hidden />
        Salir
      </button>
    </MarcoPaso>
  );
}
