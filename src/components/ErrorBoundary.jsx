import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { t } from "../utils/i18n";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const T = (key) => t(this.props.lang || "fr", key);
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <AlertTriangle size={64} className="text-red-400 mb-6" />
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            {T("error_title")}
          </h1>
          <p
            className="text-sm mb-6"
            style={{ color: "var(--text-secondary)" }}
          >
            {T("error_subtitle")}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw size={16} /> {T("error_reload")}
          </button>
          {this.state.error && (
            <details className="mt-6 w-full max-w-lg">
              <summary
                className="text-xs cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                {T("error_details")}
              </summary>
              <pre
                className="mt-2 p-3 rounded-lg text-xs overflow-auto text-left"
                style={{
                  background: "var(--bg-alt)",
                  color: "var(--text-secondary)",
                }}
              >
                {this.state.error.message}
                {"\n"}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
