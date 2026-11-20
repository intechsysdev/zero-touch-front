import { useId, useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { MarcaProducto } from './Marca';
import { MenuUsuario } from './MenuUsuario';
import type { OpcionEmpresa } from './MenuUsuario';
import { useTema } from '../tema/TemaContexto';

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
  grupos: GrupoMenu[];
  /** Quién entró: su nombre o, si One no lo dio, su correo. */
  nombre: string;
  correo?: string;
  /** Segunda línea del menú de la cuenta: «Rol · Empresa». */
  detalle: string;
  /** Las empresas entre las que puede cambiar; con una sola, la sección no aparece. */
  empresas: OpcionEmpresa[];
  empresaActiva?: string;
  onElegirEmpresa: (id: string) => void;
  onSalir: () => void;
};

/**
 * Marco de navegación de la consola, igual al de WorkLog (AppShell): la marca, las secciones y, al
 * pie, el menú de la cuenta (empresa, tema y salida). Desde 901 px el panel va fijo a la
 * izquierda; por debajo es la barra de arriba, y el botón lo despliega debajo de ella.
 */
export function MenuLateral({
  grupos,
  nombre,
  correo,
  detalle,
  empresas,
  empresaActiva,
  onElegirEmpresa,
  onSalir,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  const { oscuro, alternar } = useTema();
  const cerrar = () => setAbierto(false);

  return (
    <>
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>

      <aside className="menu-lateral">
        <div className="menu-cabeza">
          <MarcaProducto />
          <button
            type="button"
            className="menu-boton"
            aria-expanded={abierto}
            aria-controls="panel-nav"
            aria-label={abierto ? 'Cerrar el menú' : 'Abrir el menú'}
            onClick={() => setAbierto((valor) => !valor)}
          >
            {abierto ? <X aria-hidden /> : <Menu aria-hidden />}
          </button>
        </div>

        {/* En pantallas angostas el panel solo se ve desplegado; desde 901 px, siempre. */}
        <div id="panel-nav" className={abierto ? 'menu-cuerpo' : 'menu-cuerpo menu-plegado'}>
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
                    <Entrada key={entrada.nombre} entrada={entrada} alElegir={cerrar} />
                  ))}
                </div>
              );
            })}
          </nav>

          <div className="menu-pie">
            <MenuUsuario
              nombre={nombre}
              correo={correo ?? null}
              detalle={detalle}
              empresas={empresas}
              empresaActiva={empresaActiva ?? null}
              alElegirEmpresa={onElegirEmpresa}
              oscuro={oscuro}
              alAlternarTema={alternar}
              alSalir={onSalir}
            />
          </div>
        </div>
      </aside>
    </>
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
