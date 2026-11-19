import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PRODUCTO } from '../producto';
import { MarcaProducto } from './Marca';
import { SelectorTema } from './SelectorTema';

/** Una entrada del menú: un enlace (href) o un botón que hace algo (onElegir). */
export type EntradaMenu = {
  nombre: string;
  Icono: LucideIcon;
  /** La que corresponde a lo que se ve: lleva el estilo de activa y aria-current="page". */
  activa?: boolean;
  href?: string;
  onElegir?: () => void;
};

export type GrupoMenu = {
  /** Solo si el grupo aporta claridad. */
  titulo?: string;
  entradas: EntradaMenu[];
};

type Props = {
  /** Empresa activa, bajo la marca. */
  empresa?: string;
  /** Con varias empresas, el selector va bajo la marca a todo el ancho. */
  selectorEmpresa?: ReactNode;
  grupos: GrupoMenu[];
  /** Correo o nombre del usuario, en el pie. */
  usuario?: string;
  onSalir: () => void;
};

/** Desde este ancho el panel queda fijo a la izquierda; por debajo, barra arriba y cajón. */
const ESCRITORIO = '(min-width: 1024px)';

/**
 * Marco de navegación de la consola, igual al del portal de One. En escritorio el panel va fijo a
 * la izquierda; en pantallas angostas hay una barra arriba y el botón abre el mismo panel como
 * cajón. El cajón es un <dialog> modal: Escape lo cierra y el foco no se escapa, de forma nativa.
 */
export function MenuLateral(props: Props) {
  const [abierto, setAbierto] = useState(false);
  const cajonRef = useRef<HTMLDialogElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);

  function abrir() {
    const cajon = cajonRef.current;
    if (!cajon || cajon.open) return;
    cajon.showModal();
    setAbierto(true);
    // showModal enfoca lo primero que encuentra (el selector de empresa, si lo hay): se lleva a
    // la primera entrada del menú.
    cajon.querySelector<HTMLElement>('.menu-entrada')?.focus();
  }

  function cerrar() {
    cajonRef.current?.close();
  }

  // El cajón se cierra por varias vías (Escape, el fondo, una entrada, ensanchar la ventana) y
  // todas pasan por el evento close: aquí se sincroniza el estado y el foco vuelve al botón.
  function alCerrar() {
    setAbierto(false);
    botonRef.current?.focus({ preventScroll: true });
  }

  // Si la ventana se ensancha con el cajón abierto, el panel fijo ya está a la vista.
  useEffect(() => {
    const consulta = window.matchMedia(ESCRITORIO);
    const alCambiar = () => {
      if (consulta.matches) cajonRef.current?.close();
    };
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  return (
    <>
      <aside className="menu-lateral">
        <PanelMenu {...props} />
      </aside>

      <header className="barra-movil">
        <button
          ref={botonRef}
          type="button"
          className="boton-menu"
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={abierto}
          aria-controls="menu-cajon"
          onClick={abierto ? cerrar : abrir}
        >
          {abierto ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>
        <MarcaProducto className="barra-movil-marca" />
        {/* Si la marca completa no cabe, la compacta con el nombre del producto. */}
        <span className="barra-movil-corta">
          <MarcaProducto compacta />
          <span className="barra-movil-nombre">{PRODUCTO.nombre}</span>
        </span>
      </header>

      {/* El panel llena el cajón: un clic cuyo destino es el propio <dialog> vino del fondo. */}
      <dialog
        id="menu-cajon"
        ref={cajonRef}
        className="menu-cajon"
        aria-label="Menú"
        onClose={alCerrar}
        onClick={(event) => {
          if (event.target === event.currentTarget) cerrar();
        }}
      >
        <PanelMenu {...props} alElegir={cerrar} />
      </dialog>
    </>
  );
}

/** Contenido del panel: marca, navegación y pie. Se dibuja en el panel fijo y en el cajón. */
function PanelMenu({
  empresa,
  selectorEmpresa,
  grupos,
  usuario,
  onSalir,
  alElegir,
}: Props & { alElegir?: () => void }) {
  // El panel se dibuja dos veces (fijo y cajón): los ids tienen que ser de cada copia.
  const id = useId();

  return (
    <div className="menu-panel">
      <div className="menu-marca">
        <MarcaProducto className="menu-marca-fila" />
        {empresa ? <p className="menu-empresa">{empresa}</p> : null}
        {selectorEmpresa}
      </div>

      <nav className="menu-navegacion" aria-label="Principal">
        {grupos.map((grupo, indice) => {
          const idTitulo = `${id}-grupo-${indice}`;
          return (
            <div
              key={grupo.titulo ?? indice}
              className="menu-grupo"
              role="group"
              aria-labelledby={grupo.titulo ? idTitulo : undefined}
            >
              {grupo.titulo ? (
                <p id={idTitulo} className="menu-grupo-titulo">
                  {grupo.titulo}
                </p>
              ) : null}

              {grupo.entradas.map((entrada) => (
                <Entrada key={entrada.nombre} entrada={entrada} alElegir={alElegir} />
              ))}
            </div>
          );
        })}
      </nav>

      <div className="menu-pie">
        {usuario ? (
          <p className="menu-usuario" title={usuario}>
            {usuario}
          </p>
        ) : null}
        <div className="menu-pie-fila">
          <SelectorTema />
          <button className="boton-salir" onClick={onSalir} type="button" title="Cerrar sesión">
            <LogOut aria-hidden />
            <span>Salir</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Entrada({ entrada, alElegir }: { entrada: EntradaMenu; alElegir?: () => void }) {
  const { nombre, Icono, activa, href, onElegir } = entrada;
  const contenido = (
    <>
      <Icono aria-hidden />
      <span>{nombre}</span>
    </>
  );
  const elegir = () => {
    onElegir?.();
    alElegir?.();
  };

  if (href) {
    return (
      <a className="menu-entrada" href={href} aria-current={activa ? 'page' : undefined} onClick={elegir}>
        {contenido}
      </a>
    );
  }

  return (
    <button
      type="button"
      className="menu-entrada"
      aria-current={activa ? 'page' : undefined}
      onClick={elegir}
    >
      {contenido}
    </button>
  );
}
