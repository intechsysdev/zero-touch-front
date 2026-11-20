/** Los roles de One con los nombres que usa el portal. */
const ROLES_ONE: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  member: 'Miembro',
  viewer: 'Observador',
};

export function nombreRol(rol: string): string {
  return ROLES_ONE[rol.toLowerCase()] ?? rol;
}
