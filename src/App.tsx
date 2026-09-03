import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';

type AuthSession = {
  accessToken: string;
  companyName: string;
  email: string;
  clientId: string;
  zeroTouchCustomerId?: string;
};

type DeviceIdentifier = {
  imei?: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
};

type RawDevice = {
  name?: string;
  deviceId?: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  deviceIdentifier?: DeviceIdentifier;
  claims?: Array<{ ownerCompanyId?: string; createTime?: string }>;
};

type ManagedDevice = {
  id: string;
  serialOrImei: string;
  model: string;
  manufacturer: string;
  imei?: string;
  serialNumber?: string;
  createdAt?: string;
  ownerCompanyId?: string;
};

type IdentifierType = 'imei' | 'serial';

type IdentifierOptionsResponse = {
  manufacturers?: string[];
  modelsByManufacturer?: Record<string, string[]>;
};

type BulkClaimResponse = {
  summary?: {
    total?: number;
    successCount?: number;
    failedCount?: number;
  };
};

const BACKEND_BASE_URL =
  import.meta.env.VITE_BACKEND_BASE_URL ||
  'https://intechsys-backend-prod-w2.lemondesert-86c4a20f.westus2.azurecontainerapps.io';
const SESSION_KEY = 'zt-web-session-v1';

function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') {
    return 'Error inesperado.';
  }

  const maybeError = error as { message?: string };
  return maybeError.message || 'Error inesperado.';
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers, ...requestOptions } = options;
  const customHeaders = headers || {};

  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...customHeaders,
    },
    ...requestOptions,
  });

  const text = await response.text();
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      (payload as { message?: string })?.message ||
      `Error HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

function mapDevice(raw: RawDevice): ManagedDevice {
  const identifier = raw.deviceIdentifier || {};
  const serialOrImei =
    raw.serialNumber ||
    identifier.serialNumber ||
    identifier.imei ||
    raw.deviceId ||
    raw.name ||
    'N/A';

  return {
    id: raw.deviceId || raw.name || serialOrImei,
    serialOrImei,
    model: raw.model || identifier.model || 'Dispositivo',
    manufacturer: raw.manufacturer || identifier.manufacturer || 'N/A',
    imei: identifier.imei,
    serialNumber: raw.serialNumber || identifier.serialNumber,
    createdAt: raw.claims?.[0]?.createTime,
    ownerCompanyId: raw.claims?.[0]?.ownerCompanyId,
  };
}

function mergeUnique(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const item of values) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

function parseIdentifiers(text: string): string[] {
  return mergeUnique(text.split(/[\s,;]+/g).map((item) => item.trim()));
}

function splitSimpleCsvLine(line: string): string[] {
  const values: string[] = [];
  let buffer = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && i + 1 < line.length && line[i + 1] === '"') {
        buffer += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === ',' && !insideQuotes) {
      values.push(buffer.trim());
      buffer = '';
    } else {
      buffer += char;
    }
  }

  values.push(buffer.trim());
  return values;
}

function extractFromCsvLikeText(source: string, identifierType: IdentifierType): string[] {
  const lines = source
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const header = splitSimpleCsvLine(lines[0]).map((item) => item.toLowerCase());
  const hasHeader = header.some((item) => ['modemid', 'imei', 'serial', 'serialnumber'].includes(item));
  if (!hasHeader) {
    return parseIdentifiers(source);
  }

  const indexOf = (key: string) => header.indexOf(key);
  const modemIdIndex = indexOf('modemid');
  const imeiIndex = indexOf('imei');
  const serialIndex = indexOf('serial');
  const serialNumberIndex = indexOf('serialnumber');

  const extracted: string[] = [];
  for (const line of lines.slice(1)) {
    const columns = splitSimpleCsvLine(line);

    if (identifierType === 'imei') {
      for (const index of [modemIdIndex, imeiIndex]) {
        if (index >= 0 && index < columns.length && columns[index].trim()) {
          extracted.push(columns[index].trim());
          break;
        }
      }
    } else {
      for (const index of [serialIndex, serialNumberIndex]) {
        if (index >= 0 && index < columns.length && columns[index].trim()) {
          extracted.push(columns[index].trim());
          break;
        }
      }
    }
  }

  return mergeUnique(extracted);
}

function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [devices, setDevices] = useState<ManagedDevice[]>([]);

  const [email, setEmail] = useState('');
  const [clientId, setClientId] = useState('');

  const [successText, setSuccessText] = useState('');
  const [identifierType, setIdentifierType] = useState<IdentifierType>('imei');
  const [bulkIdentifiersText, setBulkIdentifiersText] = useState('');
  const [bulkManufacturer, setBulkManufacturer] = useState('');
  const [bulkModel, setBulkModel] = useState('');
  const [bulkConfigurationId, setBulkConfigurationId] = useState('');
  const [availableManufacturers, setAvailableManufacturers] = useState<string[]>([]);
  const [modelsByManufacturer, setModelsByManufacturer] = useState<Record<string, string[]>>({});
  const [scannerOpen, setScannerOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const parsedIdentifiers = useMemo(() => parseIdentifiers(bulkIdentifiersText), [bulkIdentifiersText]);
  const canCreate = parsedIdentifiers.length > 0 &&
    (identifierType === 'imei' || (bulkManufacturer.trim().length > 0 && bulkModel.trim().length > 0));

  const selectedModels = useMemo(
    () => modelsByManufacturer[bulkManufacturer] || [],
    [bulkManufacturer, modelsByManufacturer]
  );

  useEffect(() => {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as AuthSession;
      if (parsed?.accessToken) {
        setSession(parsed);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    void loadDevices(true);
    void loadIdentifierOptions(true);
  }, [session]);

  async function loadIdentifierOptions(forceSync: boolean) {
    if (!session) {
      return;
    }

    try {
      const query = forceSync ? '?forceSync=true' : '';
      const data = await apiRequest<IdentifierOptionsResponse>(
        `/zerotouch/devices/identifier-options${query}`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );

      const manufacturers = Array.isArray(data.manufacturers)
        ? data.manufacturers.filter(Boolean)
        : [];
      setAvailableManufacturers(manufacturers);
      setModelsByManufacturer(data.modelsByManufacturer || {});
    } catch (error) {
      setErrorText(getErrorMessage(error));
    }
  }

  async function loadDevices(forceSync: boolean) {
    if (!session) {
      return;
    }

    setIsBusy(true);
    setErrorText('');
    try {
      const query = forceSync ? '?forceSync=true' : '';
      const data = await apiRequest<{ devices: RawDevice[] }>(
        `/zerotouch/devices${query}`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );

      const list = Array.isArray(data.devices) ? data.devices : [];
      setDevices(list.map(mapDevice));
    } catch (error) {
      setErrorText(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedClientId = clientId.trim();
    if (!normalizedClientId) {
      setErrorText('Client ID es obligatorio.');
      return;
    }

    setIsBusy(true);
    setErrorText('');
    try {
      const data = await apiRequest<AuthSession>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          clientId: normalizedClientId,
          password: normalizedClientId,
        }),
      });

      setSession(data);
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch (error) {
      setErrorText(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  function handleLogout() {
    setSession(null);
    setDevices([]);
    setErrorText('');
    setSuccessText('');
    setAvailableManufacturers([]);
    setModelsByManufacturer({});
    localStorage.removeItem(SESSION_KEY);
  }

  function appendIdentifier(value: string) {
    const merged = mergeUnique([...parsedIdentifiers, value]);
    setBulkIdentifiersText(merged.join('\n'));
  }

  function downloadTemplateCsv() {
    if (!session) {
      return;
    }

    const owner = session.zeroTouchCustomerId || session.clientId;
    const csv =
      identifierType === 'imei'
        ? `modemtype,modemid,profiletype,owner\nIMEI,123456789012345,ZERO_TOUCH,${owner}\nIMEI,234567890123456,ZERO_TOUCH,${owner}\n`
        : `serial,model,manufacturer,profiletype,owner\nSN-001,SM-A155M,Samsung,ZERO_TOUCH,${owner}\nSN-002,Redmi-12,Xiaomi,ZERO_TOUCH,${owner}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zt-template-${identifierType}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const content = await file.text();
      const imported = extractFromCsvLikeText(content, identifierType);
      if (imported.length === 0) {
        setErrorText('No se detectaron identificadores validos en el archivo.');
        return;
      }

      const merged = mergeUnique([...parsedIdentifiers, ...imported]);
      setBulkIdentifiersText(merged.join('\n'));
      setSuccessText(`Importados ${imported.length} registros. Total actual: ${merged.length}.`);
      setErrorText('');
    } catch {
      setErrorText('No fue posible leer el archivo.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleCreateDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }

    if (parsedIdentifiers.length === 0) {
      setErrorText('Agrega al menos un identificador.');
      return;
    }

    if (identifierType === 'serial' && (!bulkManufacturer.trim() || !bulkModel.trim())) {
      setErrorText('Para serial debes indicar marca y modelo.');
      return;
    }

    const devicesPayload =
      identifierType === 'imei'
        ? parsedIdentifiers.map((value) => ({ imei: value }))
        : parsedIdentifiers.map((value) => ({
            serialNumber: value,
            manufacturer: bulkManufacturer.trim(),
            model: bulkModel.trim(),
          }));

    setIsBusy(true);
    setErrorText('');
    setSuccessText('');
    try {
      const response = await apiRequest<BulkClaimResponse>('/zerotouch/devices/claim/bulk', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          customerId: session.zeroTouchCustomerId || session.clientId,
          identifierType,
          configurationId: bulkConfigurationId.trim() || undefined,
          devices: devicesPayload,
        }),
      });

      const total = response.summary?.total ?? parsedIdentifiers.length;
      const ok = response.summary?.successCount ?? 0;
      const failed = response.summary?.failedCount ?? Math.max(0, total - ok);

      setSuccessText(`Carga finalizada: ${ok}/${total} exitosos, ${failed} fallidos.`);

      await loadDevices(true);
      await loadIdentifierOptions(false);
    } catch (error) {
      setErrorText(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteDevice(device: ManagedDevice) {
    if (!session) {
      return;
    }

    const confirmed = window.confirm(
      `Vas a eliminar el dispositivo ${device.serialOrImei}. Deseas continuar?`
    );
    if (!confirmed) {
      return;
    }

    const deviceIdentifier: DeviceIdentifier = device.imei
      ? { imei: device.imei }
      : {
          serialNumber: device.serialNumber,
          manufacturer: device.manufacturer !== 'N/A' ? device.manufacturer : undefined,
          model: device.model,
        };

    setIsBusy(true);
    setErrorText('');
    try {
      await apiRequest('/zerotouch/devices/unclaim', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ deviceIdentifier }),
      });

      await loadDevices(true);
    } catch (error) {
      setErrorText(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="kicker">Intechsys Zero-touch</p>
          <h1>Console Web</h1>
        </div>
        {session ? (
          <button className="ghost-btn" onClick={handleLogout} type="button">
            Cerrar sesion
          </button>
        ) : null}
      </header>

      {errorText ? <div className="error-banner">{errorText}</div> : null}
      {successText ? <div className="success-banner">{successText}</div> : null}

      {!session ? (
        <section className="panel login-panel">
          <h2>Ingreso por cliente</h2>
          <p>
            Para este MVP, password se envia automaticamente igual al Client ID.
          </p>
          <form onSubmit={handleLogin} className="form-grid">
            <label>
              Email (opcional)
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="operaciones@empresa.com"
              />
            </label>
            <label>
              Client ID
              <input
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                placeholder="1295751765"
                required
              />
            </label>
            <button className="primary-btn" type="submit" disabled={isBusy}>
              {isBusy ? 'Conectando...' : 'Ingresar'}
            </button>
          </form>
        </section>
      ) : (
        <>
          <section className="panel info-panel">
            <div>
              <p className="label">Empresa</p>
              <strong>{session.companyName}</strong>
            </div>
            <div>
              <p className="label">Client ID</p>
              <strong>{session.clientId}</strong>
            </div>
            <div>
              <p className="label">Customer ID</p>
              <strong>{session.zeroTouchCustomerId || session.clientId}</strong>
            </div>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => void loadDevices(true)}
              disabled={isBusy}
            >
              {isBusy ? 'Sincronizando...' : 'Force Sync'}
            </button>
          </section>

          <section className="panel">
            <h2>Carga masiva de dispositivos</h2>
            <form onSubmit={handleCreateDevice} className="form-grid form-grid-create">
              <div className="field-block full-width">
                <p className="label">Tipo de identificador</p>
                <div className="segmented">
                  <button
                    className={identifierType === 'imei' ? 'tab-btn active' : 'tab-btn'}
                    type="button"
                    onClick={() => setIdentifierType('imei')}
                  >
                    IMEI
                  </button>
                  <button
                    className={identifierType === 'serial' ? 'tab-btn active' : 'tab-btn'}
                    type="button"
                    onClick={() => setIdentifierType('serial')}
                  >
                    Serial + Marca + Modelo
                  </button>
                </div>
              </div>
              <div className="field-block full-width inline-actions">
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy}
                >
                  Importar CSV/TXT
                </button>
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={downloadTemplateCsv}
                  disabled={isBusy}
                >
                  Descargar plantilla CSV
                </button>
                {identifierType === 'imei' ? (
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => setScannerOpen((value) => !value)}
                  >
                    {scannerOpen ? 'Cerrar lector QR' : 'Abrir lector QR'}
                  </button>
                ) : null}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={handleImportFile}
                  className="hidden-input"
                />
              </div>
              {scannerOpen && identifierType === 'imei' ? (
                <div className="qr-box full-width">
                  <BarcodeScannerComponent
                    width={480}
                    height={280}
                    onUpdate={(_, result) => {
                      const value = result?.getText?.()?.trim() || '';
                      if (!value) {
                        return;
                      }
                      appendIdentifier(value);
                    }}
                  />
                  <p className="hint">Escanea uno o varios codigos para agregar IMEIs al lote.</p>
                </div>
              ) : null}
              <label>
                {identifierType === 'imei'
                  ? 'IMEI(s): uno por linea o por coma'
                  : 'Serial(es): uno por linea o por coma'}
                <textarea
                  value={bulkIdentifiersText}
                  onChange={(event) => setBulkIdentifiersText(event.target.value)}
                  placeholder={
                    identifierType === 'imei'
                      ? '354612454006911\n354612454006922\n...'
                      : 'SN001\nSN002\n...'
                  }
                  rows={6}
                />
              </label>
              {identifierType === 'serial' ? (
                <label>
                  Marca
                  <input
                    list="manufacturer-options"
                    value={bulkManufacturer}
                    onChange={(event) => setBulkManufacturer(event.target.value)}
                    placeholder="Samsung"
                  />
                  <datalist id="manufacturer-options">
                    {availableManufacturers.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </label>
              ) : null}
              {identifierType === 'serial' ? (
                <label>
                  Modelo
                  <input
                    list="model-options"
                    value={bulkModel}
                    onChange={(event) => setBulkModel(event.target.value)}
                    placeholder="SM-A155M"
                  />
                  <datalist id="model-options">
                    {selectedModels.map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </label>
              ) : null}
              <label>
                Configuration ID (opcional)
                <input
                  value={bulkConfigurationId}
                  onChange={(event) => setBulkConfigurationId(event.target.value)}
                  placeholder="123456789"
                />
              </label>
              <button className="primary-btn" type="submit" disabled={!canCreate || isBusy}>
                {isBusy ? 'Procesando...' : 'Cargar lote en Zero-touch'}
              </button>
            </form>
            <p className="hint">
              Detectados: {parsedIdentifiers.length} identificadores.
            </p>
          </section>

          <section className="panel">
            <h2>Dispositivos ({devices.length})</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Identificador</th>
                    <th>Modelo</th>
                    <th>Fabricante</th>
                    <th>Owner</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.length === 0 ? (
                    <tr>
                      <td colSpan={5}>Sin dispositivos.</td>
                    </tr>
                  ) : (
                    devices.map((device) => (
                      <tr key={device.id}>
                        <td>{device.serialOrImei}</td>
                        <td>{device.model}</td>
                        <td>{device.manufacturer}</td>
                        <td>{device.ownerCompanyId || '-'}</td>
                        <td>
                          <button
                            className="danger-btn"
                            type="button"
                            onClick={() => void handleDeleteDevice(device)}
                            disabled={isBusy}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

export default App;
