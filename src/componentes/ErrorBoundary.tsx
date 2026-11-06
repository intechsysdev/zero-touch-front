import React, { Component } from 'react';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary capturó una excepción en la interfaz:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleResetToZeroTouch = (): void => {
    try {
      const raw = localStorage.getItem('zt-web-session-v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.preferredEnrollment = 'zerotouch';
        localStorage.setItem('zt-web-session-v1', JSON.stringify(parsed));
      }
    } catch {}
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const errorMessage =
        this.state.error?.message ||
        'Ocurrió un error inesperado al procesar los datos de la interfaz.';

      return (
        <div className="error-boundary-wrapper">
          <div className="panel error-boundary-card">
            <div className="error-boundary-header">
              <div className="error-boundary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div>
                <h2>{this.props.fallbackTitle || 'Se detectó un problema en la pantalla'}</h2>
                <p className="error-boundary-desc">
                  La interfaz detectó un fallo imprevisto. Sus datos y su sesión permanecen seguros.
                </p>
              </div>
            </div>

            <div className="error-banner error-boundary-banner">
              <strong>Detalle del error:</strong>
              <p style={{ marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
                {errorMessage}
              </p>
            </div>

            {this.state.errorInfo?.componentStack ? (
              <details className="error-boundary-details">
                <summary>Ver información técnica detallada</summary>
                <pre>{this.state.error?.stack || this.state.errorInfo.componentStack}</pre>
              </details>
            ) : null}

            <div className="error-boundary-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={this.handleReload}
              >
                Recargar página
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={this.handleReset}
              >
                Reintentar vista
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={this.handleResetToZeroTouch}
              >
                Volver a Zero-touch
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

