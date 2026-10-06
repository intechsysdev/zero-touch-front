import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import BarcodeScannerComponent from 'react-qr-barcode-scanner';
import { iniciarSSO, procesarCallbackSSO } from './sso';

type AuthSession = {
  accessToken: string;
  companyName: string;
  clientId: string;
  oneTenantId?: string;
  availableTenants?: Array<{
    id?: number;
    clientId: string;
    nombre: string;
    slug: string;
    oneTenantId: string;
    zeroTouchCustomerName?: string;
  }>;
  zeroTouchAvailable?: boolean;
  samsungAvailable?: boolean;
  zeroTouchCustomerId?: string;
  samsungCustomerId?: string;
  preferredEnrollment?: 'zerotouch' | 'samsung';
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
  const customHeaders = (headers || {}) as Record<string, string>;

  let sessionTenantId: string | null = null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      sessionTenantId = parsed?.oneTenantId || null;
    }
  } catch {}

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  if (sessionTenantId && !finalHeaders['X-Tenant-Id']) {
    finalHeaders['X-Tenant-Id'] = sessionTenantId;
  }

  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    headers: finalHeaders,
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
  const [deviceSearch, setDeviceSearch] = useState('');
  const [devicePageSize, setDevicePageSize] = useState(10);
  const [devicePage, setDevicePage] = useState(1);
  const [enrollmentPlatform, setEnrollmentPlatform] = useState<'zerotouch' | 'samsung'>('zerotouch');

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

  const filteredDevices = useMemo(() => {
    const query = deviceSearch.trim().toLowerCase();
    if (!query) {
      return devices;
    }

    return devices.filter((device) => {
      const haystack = [
        device.serialOrImei,
        device.model,
        device.manufacturer,
        device.ownerCompanyId || '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [deviceSearch, devices]);

  const totalPages = useMemo(() => {
    if (filteredDevices.length === 0) {
      return 1;
    }
    return Math.ceil(filteredDevices.length / devicePageSize);
  }, [filteredDevices.length, devicePageSize]);

  useEffect(() => {
    setDevicePage(1);
  }, [deviceSearch, devicePageSize]);

  useEffect(() => {
    if (devicePage > totalPages) {
      setDevicePage(totalPages);
    }
  }, [devicePage, totalPages]);

  const pagedDevices = useMemo(() => {
    const start = (devicePage - 1) * devicePageSize;
    return filteredDevices.slice(start, start + devicePageSize);
  }, [filteredDevices, devicePage, devicePageSize]);

  async function cargarSesion(token: string, tenantId?: string | null): Promise<AuthSession> {
    const reqHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (tenantId) reqHeaders['X-Tenant-Id'] = tenantId;

    const data = await apiRequest<{
      usuario: { id: string; email: string; nombre: string; esPlatformAdmin?: boolean };
      empresas: Array<{
        id?: number | null;
        clientId?: string;
        nombre?: string;
        companyName?: string;
        slug?: string;
        oneTenantId?: string;
        zeroTouchCustomerName?: string;
      }>;
      tenantActivo: {
        id?: number | null;
        clientId?: string;
        companyName?: string;
        nombre?: string;
        oneTenantId?: string;
        oneSlug?: string;
        slug?: string;
        zeroTouchCustomerName?: string;
      } | null;
    }>('/api/v1/sesion', { headers: reqHeaders });

    const active = data.tenantActivo || data.empresas?.[0];
    const companyName = active?.companyName || active?.nombre || 'Intechsys';
    const clientId = active?.clientId || active?.slug || 'cliente-one';
    const zeroTouchCustomerName = active?.zeroTouchCustomerName || '';
    const zeroTouchCustomerId = zeroTouchCustomerName.split('/').pop() || '';

    const newSession: AuthSession = {
      accessToken: token,
      companyName,
      clientId,
      oneTenantId: active?.oneTenantId || tenantId || undefined,
      availableTenants: (data.empresas || []).map((e) => ({
        id: e.id || undefined,
        clientId: e.clientId || e.slug || 'cliente',
        nombre: e.nombre || 'Empresa',
        slug: e.slug || '',
        oneTenantId: e.oneTenantId || '',
        zeroTouchCustomerName: e.zeroTouchCustomerName,
      })),
      zeroTouchAvailable: true,
      zeroTouchCustomerId: zeroTouchCustomerId || undefined,
      preferredEnrollment: 'zerotouch',
    };

    setSession(newSession);
    localStorage.setItem(SESSION_KEY, JSON.stringify(newSession));
    return newSession;
  }

  useEffect(() => {
    const pathname = window.location.pathname.replace(/\/+$/, '');
    const urlParams = new URLSearchParams(window.location.search);

    // Flujo 1: One inicia el flujo en /sso (botón en catálogo de One)
    if (pathname === '/sso') {
      const tenantParam = urlParams.get('tenant') || urlParams.get('tenantId');
      setIsBusy(true);
      void iniciarSSO(tenantParam);
      return;
    }

    // Flujo 2: One regresa con el código en /sso/callback
    if (pathname === '/sso/callback') {
      setIsBusy(true);
      procesarCallbackSSO()
        .then((ssoResult) => {
          return cargarSesion(ssoResult.accessToken, ssoResult.tenantId);
        })
        .then(() => {
          window.history.replaceState({}, document.title, '/');
        })
        .catch((err) => {
          console.error('Error procesando callback SSO de One:', err);
          setErrorText(getErrorMessage(err));
        })
        .finally(() => {
          setIsBusy(false);
        });
      return;
    }

    // Flujo 3: Token directo en URL (?token=...&tenantId=...)
    const ssoToken = urlParams.get('token') || urlParams.get('accessToken');
    const ssoTenantId = urlParams.get('tenantId') || urlParams.get('tenant');
    if (ssoToken) {
      setIsBusy(true);
      cargarSesion(ssoToken, ssoTenantId)
        .then(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => {
          setErrorText(getErrorMessage(err));
        })
        .finally(() => {
          setIsBusy(false);
        });
      return;
    }

    // Flujo 4: Sesión existente en localStorage
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as AuthSession;
      if (parsed?.accessToken) {
        setSession(parsed);
        if (parsed.preferredEnrollment === 'samsung' || parsed.samsungAvailable) {
          setEnrollmentPlatform(
            parsed.preferredEnrollment === 'zerotouch' ? 'zerotouch' : 'samsung'
          );
        }
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
    if (isSamsungMode) {
      setAvailableManufacturers([]);
      setModelsByManufacturer({});
    } else {
      void loadIdentifierOptions(true);
    }
  }, [session, enrollmentPlatform]);

  const activeCustomerId =
    enrollmentPlatform === 'samsung'
      ? session?.samsungCustomerId || session?.clientId
      : session?.zeroTouchCustomerId;

  const isSamsungMode = enrollmentPlatform === 'samsung';

  function pathForDevices() {
    return isSamsungMode ? '/samsung/devices' : '/zerotouch/devices';
  }

  function pathForBulkClaim() {
    return isSamsungMode ? '/samsung/devices/claim/bulk' : '/zerotouch/devices/claim/bulk';
  }

  function pathForUnclaim() {
    return isSamsungMode ? '/samsung/devices/unclaim' : '/zerotouch/devices/unclaim';
  }

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

    if (isSamsungMode && !activeCustomerId) {
      return;
    }

    setIsBusy(true);
    setErrorText('');
    try {
      const data = await apiRequest<{ devices: RawDevice[] }>(
        `${pathForDevices()}${
          activeCustomerId
            ? `?customerId=${encodeURIComponent(activeCustomerId)}${
                forceSync && !isSamsungMode ? '&forceSync=true' : ''
              }`
            : forceSync && !isSamsungMode
              ? '?forceSync=true'
              : ''
        }`,
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
    setDeviceSearch('');
    setErrorText('');
    setSuccessText('');
    setAvailableManufacturers([]);
    setModelsByManufacturer({});
    setDevicePage(1);
    setDevicePageSize(10);
    setEnrollmentPlatform('zerotouch');
    setEmail('');
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

    if (isSamsungMode && !activeCustomerId) {
      return;
    }

    if (parsedIdentifiers.length === 0) {
      setErrorText('Agrega al menos un identificador.');
      return;
    }

    if (!isSamsungMode && identifierType === 'serial' && (!bulkManufacturer.trim() || !bulkModel.trim())) {
      setErrorText('Para serial debes indicar marca y modelo.');
      return;
    }

    if (isSamsungMode && !bulkConfigurationId.trim()) {
      setErrorText('Para Samsung debes enviar Profile ID.');
      return;
    }

    const devicesPayload =
      isSamsungMode || identifierType === 'imei'
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
      const response = await apiRequest<BulkClaimResponse>(pathForBulkClaim(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          customerId: activeCustomerId || undefined,
          identifierType: isSamsungMode ? 'imei' : identifierType,
          profileId: isSamsungMode ? bulkConfigurationId.trim() : undefined,
          configurationId: isSamsungMode ? undefined : (bulkConfigurationId.trim() || undefined),
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
      await apiRequest(pathForUnclaim(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify(
          isSamsungMode
            ? { deviceIds: [device.imei || device.serialNumber || device.id] }
            : { deviceIdentifier }
        ),
      });

      await loadDevices(true);
    } catch (error) {
      setErrorText(getErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className={`app-shell ${isSamsungMode ? 'samsung-mode' : ''}`}>
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
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <button
              type="button"
              className="primary-btn"
              style={{
                width: '100%',
                backgroundColor: '#0284c7',
                padding: '0.85rem',
                fontSize: '1rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
              onClick={() => void iniciarSSO()}
            >
              Iniciar sesión con Intechsys One
            </button>
            <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
              — o usar credenciales locales de cliente —
            </p>
          </div>

          <h2>Ingreso por cliente</h2>
          <p>
            Para este MVP, password se envia automaticamente igual al Client ID. Si es Samsung Knox, el correo es obligatorio.
          </p>
          <form onSubmit={handleLogin} className="form-grid">
            <label>
              Correo (obligatorio para Samsung Knox)
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="sales@knox.intechsyscol.com"
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
            {session.availableTenants && session.availableTenants.length > 1 ? (
              <div>
                <p className="label">Empresa Activa</p>
                <select
                  value={session.oneTenantId || ''}
                  style={{
                    padding: '0.4rem 0.6rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    fontWeight: 600,
                  }}
                  onChange={(e) => {
                    const selected = session.availableTenants?.find(
                      (t) => t.oneTenantId === e.target.value
                    );
                    if (selected) {
                      void cargarSesion(session.accessToken, selected.oneTenantId);
                    }
                  }}
                >
                  {session.availableTenants.map((t) => (
                    <option key={t.oneTenantId} value={t.oneTenantId}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <p className="label">Empresa</p>
                <strong>{session.companyName}</strong>
              </div>
            )}
            <div>
              <p className="label">Client ID</p>
              <strong>{session.clientId}</strong>
            </div>
            <div>
              <p className="label">Customer ID</p>
              <strong>{activeCustomerId || '-'}</strong>
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
            <h2>Plataforma de Enrolamiento</h2>
            <div className="segmented">
              <button
                className={enrollmentPlatform === 'zerotouch' ? 'tab-btn active' : 'tab-btn'}
                type="button"
                disabled={!session.zeroTouchAvailable}
                onClick={() => setEnrollmentPlatform('zerotouch')}
              >
                Zero-touch
              </button>
              <button
                className={enrollmentPlatform === 'samsung' ? 'tab-btn active' : 'tab-btn'}
                type="button"
                disabled={!session.samsungAvailable}
                onClick={() => setEnrollmentPlatform('samsung')}
              >
                Samsung Knox
              </button>
            </div>
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
                    disabled={isSamsungMode}
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
              {!isSamsungMode && identifierType === 'serial' ? (
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
              {!isSamsungMode && identifierType === 'serial' ? (
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
                {isSamsungMode ? 'Samsung Profile ID (obligatorio)' : 'Configuration ID (opcional)'}
                <input
                  value={bulkConfigurationId}
                  onChange={(event) => setBulkConfigurationId(event.target.value)}
                  placeholder={isSamsungMode ? 'KNOX_PROFILE_001' : '123456789'}
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
            <h2>Dispositivos ({filteredDevices.length}/{devices.length})</h2>
            <label>
              Buscar por Identificador, Modelo, Fabricante u Owner
              <div className="search-input-wrap">
                <input
                  value={deviceSearch}
                  onChange={(event) => setDeviceSearch(event.target.value)}
                  placeholder="Ej: 50057711500955, Dispositivo, N/A, 1408308716"
                />
                {deviceSearch.trim() ? (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => setDeviceSearch('')}
                    aria-label="Limpiar busqueda"
                    title="Limpiar busqueda"
                  >
                    x
                  </button>
                ) : null}
              </div>
            </label>
            <div className="pagination-bar">
              <label className="pagination-size">
                Mostrar
                <select
                  value={devicePageSize}
                  onChange={(event) => setDevicePageSize(Number(event.target.value))}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                </select>
              </label>
              <p className="hint">
                {filteredDevices.length === 0
                  ? 'Mostrando 0 de 0'
                  : `Mostrando ${(devicePage - 1) * devicePageSize + 1}-${Math.min(devicePage * devicePageSize, filteredDevices.length)} de ${filteredDevices.length}`}
              </p>
              <div className="pagination-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setDevicePage((current) => Math.max(1, current - 1))}
                  disabled={devicePage <= 1}
                >
                  Anterior
                </button>
                <span className="pagination-page">Pagina {devicePage} de {totalPages}</span>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setDevicePage((current) => Math.min(totalPages, current + 1))}
                  disabled={devicePage >= totalPages}
                >
                  Siguiente
                </button>
              </div>
            </div>
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
                  {pagedDevices.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        {devices.length === 0
                          ? 'Sin dispositivos.'
                          : 'No hay coincidencias para la busqueda.'}
                      </td>
                    </tr>
                  ) : (
                    pagedDevices.map((device) => (
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
