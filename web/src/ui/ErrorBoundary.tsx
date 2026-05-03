import React, { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="rounded-lg border border-red-800 bg-red-950 p-6">
            <h1 className="text-xl font-semibold text-red-300">Something went wrong</h1>
            <p className="mt-2 text-red-200">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm text-white hover:bg-red-600"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
            <details className="mt-4 text-xs text-red-200">
              <summary>Technical details</summary>
              <pre className="mt-2 overflow-auto rounded bg-red-900 p-2">
                {this.state.error?.stack}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
