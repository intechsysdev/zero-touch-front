import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Building2, Check, ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface OpcionEmpresa {
  id: string;
  nombre: string;
  /** Ícono de la opción cuando no es la activa. Por defecto, el de empresa. */
  icono?: LucideIcon;
}

interface Props {
  /** Nombre de quien entró o, si One no lo dio, su correo. */
  nombre: string;
  correo: string | null;
  /** Segunda línea del botón: «Rol · Empresa». */
  detalle: string;
  /** Las empresas entre las que puede cambiar; con una sola, la sección no aparece. */
  empresas: OpcionEmpresa[];
  empresaActiva: string | null;
  alElegirEmpresa: (id: string) => void;
  oscuro: boolean;
  alAlternarTema: () => void;
  alSalir: () => void;
}

/** «Ana Rodríguez» → AR; de un correo, las iniciales de lo que va antes de la arroba. */
function iniciales(nombre: string): string {
  const palabras = nombre.split('@')[0].split(/[\s._-]+/).filter(Boolean);
  return palabras.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '?';
}

/**
 * Menú de la cuenta al pie del panel lateral, el mismo de WorkLog (UserMenu): el avatar con el
 * nombre y «rol · empresa» abre hacia arriba un menú con la empresa, el tema y la salida.
 */
export function MenuUsuario({
  nombre, correo, detalle, empresas, empresaActiva, alElegirEmpresa, oscuro, alAlternarTema, alSalir,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [altoMaximo, setAltoMaximo] = useState<number>();
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!abierto) return;

    const alPulsar = (evento: PointerEvent) => {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    };
    // En captura y cancelando: dentro del cajón (un <dialog>), Escape cierra el menú, no el cajón.
    const alTeclear = (evento: globalThis.KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      evento.preventDefault();
      evento.stopPropagation();
      setAbierto(false);
      boton.current?.focus();
    };

    document.addEventListener('pointerdown', alPulsar);
    document.addEventListener('keydown', alTeclear, true);
    const espera = window.setTimeout(
      () => contenedor.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus(),
      30,
    );

    return () => {
      document.removeEventListener('pointerdown', alPulsar);
      document.removeEventListener('keydown', alTeclear, true);
      window.clearTimeout(espera);
    };
  }, [abierto]);

  const alTeclearEnMenu = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return;
    evento.preventDefault();
    const opciones = Array.from(contenedor.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? []);
    const actual = opciones.indexOf(document.activeElement as HTMLElement);
    const paso = evento.key === 'ArrowDown' ? 1 : -1;
    opciones[(actual + paso + opciones.length) % opciones.length]?.focus();
  };

  const cerrar = () => setAbierto(false);

  return (
    <div ref={contenedor} className="menu-usuario">
      <button
        ref={boton}
        type="button"
        className="menu-usuario-boton"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls={abierto ? id : undefined}
        onClick={() => {
          // La lista sale hacia arriba: con muchas empresas, o con poco espacio encima, se
          // desplaza por dentro en vez de salirse de la ventana.
          const arriba = boton.current?.getBoundingClientRect().top ?? 0;
          setAltoMaximo(Math.max(160, arriba - 12));
          setAbierto((valor) => !valor);
        }}
      >
        <span className="menu-usuario-avatar" aria-hidden>{iniciales(nombre)}</span>
        <span className="menu-usuario-texto">
          <span className="menu-usuario-nombre">{nombre}</span>
          <span className="menu-usuario-detalle">{detalle}</span>
        </span>
        <ChevronsUpDown aria-hidden />
      </button>

      {abierto && (
        <div id={id} role="menu" className="menu-usuario-lista" style={{ maxHeight: altoMaximo }} onKeyDown={alTeclearEnMenu}>
          <div className="menu-usuario-cabeza">
            <p className="menu-usuario-nombre">{nombre}</p>
            {correo && correo !== nombre && <p className="menu-usuario-detalle">{correo}</p>}
          </div>

          {empresas.length > 1 && (
            <>
              <hr />
              <p className="menu-usuario-etiqueta">Empresa</p>
              {empresas.map((empresa) => {
                const activa = empresa.id === empresaActiva;
                const Icono = activa ? Check : (empresa.icono ?? Building2);
                return (
                  <button
                    key={empresa.id}
                    type="button"
                    role="menuitem"
                    className="menu-usuario-opcion"
                    aria-current={activa || undefined}
                    onClick={() => {
                      cerrar();
                      if (!activa) alElegirEmpresa(empresa.id);
                    }}
                  >
                    <Icono aria-hidden />
                    <span>{empresa.nombre}</span>
                  </button>
                );
              })}
            </>
          )}

          <hr />
          <button
            type="button"
            role="menuitem"
            className="menu-usuario-opcion"
            onClick={() => {
              alAlternarTema();
              cerrar();
            }}
          >
            {oscuro ? <Sun aria-hidden /> : <Moon aria-hidden />}
            {oscuro ? 'Usar tema claro' : 'Usar tema oscuro'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-usuario-opcion menu-usuario-peligro"
            onClick={() => {
              cerrar();
              alSalir();
            }}
          >
            <LogOut aria-hidden />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
