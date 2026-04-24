import "./LoginPage.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import appLogo from "../../assets/logo-elpatron.png";
import { getErrorMessage } from "../../utils/error";
import LoadingPage from "../LoadingPage/LoadingPage";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (error: unknown) {
      let errorMessage = "Erro ao fazer login";
      const errorCode =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: string }).code ?? "")
          : "";

      if (errorCode === "auth/user-not-found") {
        errorMessage = "Usuário não encontrado";
      } else if (
        errorCode === "auth/wrong-password" ||
        errorCode === "auth/invalid-credential"
      ) {
        errorMessage = "Senha incorreta";
      } else if (errorCode === "auth/invalid-email") {
        errorMessage = "Email inválido";
      } else if (errorCode === "auth/too-many-requests") {
        errorMessage = "Muitas tentativas. Tente novamente mais tarde";
      }

      setError(errorCode ? errorMessage : getErrorMessage(error, errorMessage));
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loading quando estiver fazendo login
  if (loading) {
    return <LoadingPage message="Fazendo login" />;
  }

  return (
    <div className="login-page">
      {/* Background animado */}
      <div className="login-background login-box-background--white login-padding-top--64">
        <div className="login-background-gridContainer">
          <div
            className="login-box-root login-flex-flex"
            style={{ gridArea: "top / start / 8 / end" }}
          >
            <div
              className="login-box-root"
              style={{
                backgroundImage:
                  "linear-gradient(white 0%, rgb(240, 245, 251) 33%)",
                flexGrow: 1,
              }}
            />
          </div>
          <div
            className="login-box-root login-flex-flex"
            style={{ gridArea: "4 / 2 / auto / 5" }}
          >
            <div
              className="login-box-root login-box-divider--light-all-2 login-animationLeftRight login-tans3s"
              style={{ flexGrow: 1 }}
            />
          </div>
          <div
            className="login-box-root login-flex-flex"
            style={{ gridArea: "6 / start / auto / 2" }}
          >
            <div
              className="login-box-root login-box-background--purple800"
              style={{ flexGrow: 1 }}
            />
          </div>
          <div
            className="login-box-root login-flex-flex"
            style={{ gridArea: "7 / start / auto / 4" }}
          >
            <div
              className="login-box-root login-box-background--purple login-animationLeftRight"
              style={{ flexGrow: 1 }}
            />
          </div>
          <div
            className="login-box-root login-flex-flex"
            style={{ gridArea: "8 / 4 / auto / 6" }}
          >
            <div
              className="login-box-root login-box-background--gray100 login-animationLeftRight login-tans3s"
              style={{ flexGrow: 1 }}
            />
          </div>
          <div
            className="login-box-root login-flex-flex"
            style={{ gridArea: "2 / 15 / auto / end" }}
          >
            <div
              className="login-box-root login-box-background--purple200 login-animationRightLeft login-tans4s"
              style={{ flexGrow: 1 }}
            />
          </div>
          <div
            className="login-box-root login-flex-flex"
            style={{ gridArea: "3 / 14 / auto / end" }}
          >
            <div
              className="login-box-root login-box-background--purple login-animationRightLeft"
              style={{ flexGrow: 1 }}
            />
          </div>
          <div
            className="login-box-root login-flex-flex"
            style={{ gridArea: "4 / 17 / auto / 20" }}
          >
            <div
              className="login-box-root login-box-background--gray100 login-animationRightLeft login-tans4s"
              style={{ flexGrow: 1 }}
            />
          </div>
          <div
            className="login-box-root login-flex-flex"
            style={{ gridArea: "5 / 14 / auto / 17" }}
          >
            <div
              className="login-box-root login-box-divider--light-all-2 login-animationRightLeft login-tans3s"
              style={{ flexGrow: 1 }}
            />
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="login-main-content">
        {/* Corpo principal com formulário centralizado */}
        <div className="login-body">
          <div className="login-form-brand login-form-brand-floating">
            <img src={appLogo} alt="El Patron" className="login-brand-logo" />
          </div>
          <div className="login-formbg-outer">
            <div className="login-formbg">
              <div className="login-formbg-inner">
                <span>Acesse sua conta</span>

                {error && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#dc2626",
                      padding: "12px",
                      borderRadius: "8px",
                      marginBottom: "16px",
                      fontSize: "14px",
                    }}
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="login-field">
                    <label htmlFor="email">Email</label>
                    <input
                      type="email"
                      name="email"
                      id="email"
                      placeholder="usuario@usuario.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="login-field">
                    <label htmlFor="password">Senha</label>
                    <input
                      type="password"
                      name="password"
                      id="password"
                      placeholder="••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="login-field">
                    <input
                      type="submit"
                      name="submit"
                      value={loading ? "Entrando..." : "Entrar"}
                      disabled={loading}
                      style={{
                        opacity: loading ? 0.7 : 1,
                        cursor: loading ? "not-allowed" : "pointer",
                      }}
                    />
                  </div>
                </form>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
