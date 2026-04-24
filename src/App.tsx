import { ToastContainer } from "./components/Toast";
import { AuthProvider, ThemeProvider } from "./contexts";
import { ToastProvider } from "./contexts/ToastContext";
import Routes from "./routes";

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ThemeProvider>
          <Routes />
          <ToastContainer />
        </ThemeProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
