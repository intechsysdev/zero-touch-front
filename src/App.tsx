import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';

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

function App() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [devices, setDevices] = useState<ManagedDevice[]>([]);

  const [email, setEmail] = useState('');
  const [clientId, setClientId] = useState('');

  const [imei, setImei] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [assignedArea, setAssignedArea] = useState('');

  const canCreate = useMemo(() => {
    const hasImei = imei.trim().length > 0;
    const hasSerialSet =
      serialNumber.trim().length > 0 &&
      manufacturer.trim().length > 0 &&
      model.trim().length > 0;
    return hasImei || hasSerialSet;
  }, [imei, serialNumber, manufacturer, model]);

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
  }, [session]);

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
    localStorage.removeItem(SESSION_KEY);
  }

  async function handleCreateDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }

    const imeiValue = imei.trim();
    const serialValue = serialNumber.trim();
    const manufacturerValue = manufacturer.trim();
    const modelValue = model.trim();

    const hasImei = imeiValue.length > 0;
    const hasSerialSet =
      serialValue.length > 0 &&
      manufacturerValue.length > 0 &&
      modelValue.length > 0;

    if (!hasImei && !hasSerialSet) {
      setErrorText('Usa IMEI o Serial Number + Manufacturer + Model.');
      return;
    }

    const deviceIdentifier: DeviceIdentifier = hasImei
      ? { imei: imeiValue }
      : {
          serialNumber: serialValue,
          manufacturer: manufacturerValue,
          model: modelValue,
        };

    setIsBusy(true);
    setErrorText('');
    try {
      await apiRequest('/zerotouch/devices/claim', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          customerId: session.zeroTouchCustomerId || session.clientId,
          deviceIdentifier,
          label: assignedArea.trim() || undefined,
        }),
      });

      setImei('');
      setSerialNumber('');
      setManufacturer('');
      setModel('');
      setAssignedArea('');

      await loadDevices(true);
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
            <h2>Crear dispositivo</h2>
            <form onSubmit={handleCreateDevice} className="form-grid form-grid-create">
              <label>
                IMEI (opcional)
                <input
                  value={imei}
                  onChange={(event) => setImei(event.target.value)}
                  placeholder="354612454006911"
                />
              </label>
              <label>
                Serial Number
                <input
                  value={serialNumber}
                  onChange={(event) => setSerialNumber(event.target.value)}
                  placeholder="R58W1234ABC"
                />
              </label>
              <label>
                Manufacturer
                <input
                  value={manufacturer}
                  onChange={(event) => setManufacturer(event.target.value)}
                  placeholder="Samsung"
                />
              </label>
              <label>
                Model
                <input
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="SM-A155M"
                />
              </label>
              <label>
                Area/Usuario
                <input
                  value={assignedArea}
                  onChange={(event) => setAssignedArea(event.target.value)}
                  placeholder="Bodega"
                />
              </label>
              <button className="primary-btn" type="submit" disabled={!canCreate || isBusy}>
                Crear en Zero-touch
              </button>
            </form>
            <p className="hint">
              Debes ingresar IMEI, o el set completo Serial Number + Manufacturer + Model.
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
