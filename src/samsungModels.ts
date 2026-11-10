/**
 * Clasificación dinámica por Familia de dispositivos Samsung Knox (Opción B).
 * No requiere listas estáticas ni quemar modelos: clasifica algorítmicamente
 * por el código estándar de hardware que entrega la API de Samsung Knox (SM-XXXX)
 * o por su nomenclatura (Galaxy Serie A, Serie S, Serie Note, Galaxy Tab, Serie Z).
 */

export function getSamsungFamily(rawModel?: string): string {
  const model = String(rawModel || '').trim();
  if (!model || model === 'Samsung Device' || model === 'Dispositivo' || model === 'N/A') {
    return 'Samsung (Sin especificar)';
  }

  // Si el texto ya contiene el nombre de la línea
  if (/note/i.test(model)) return 'Galaxy Serie Note';
  if (/tab/i.test(model)) return 'Galaxy Tab';
  if (/z\s*flip|z\s*fold|fold|flip/i.test(model)) return 'Galaxy Serie Z';
  if (/galaxy\s*s/i.test(model)) return 'Galaxy Serie S';
  if (/galaxy\s*a/i.test(model)) return 'Galaxy Serie A';

  // Por prefijo estándar de código SM-XXXX de Samsung
  const match = model.match(/^SM-([A-Z0-9])/i);
  if (match) {
    const letter = match[1].toUpperCase();
    switch (letter) {
      case 'A':
      case 'E':
      case 'M':
        return 'Galaxy Serie A';
      case 'S':
      case 'G':
        return 'Galaxy Serie S';
      case 'N':
        return 'Galaxy Serie Note';
      case 'T':
      case 'X':
      case 'P':
        return 'Galaxy Tab';
      case 'F':
      case 'W':
        return 'Galaxy Serie Z';
    }
  }

  return 'Samsung (Otros)';
}
