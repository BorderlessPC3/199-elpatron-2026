import { useEffect, useState } from "react";
import { Loading } from "../../components";
import "./LoadingPage.css";

interface LoadingPageProps {
  message?: string;
  onComplete?: () => void;
}

function LoadingPage({ message = "Carregando" }: LoadingPageProps) {
  const [dots, setDots] = useState(".");
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Pequeno delay para permitir transição suave
    const showTimer = setTimeout(() => {
      setIsVisible(true);
    }, 50);

    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === ".") return "..";
        if (prev === "..") return "...";
        return ".";
      });
    }, 500); // Muda a cada 500ms

    return () => {
      clearTimeout(showTimer);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className={`loading-page ${isVisible ? "fade-in" : "fade-out"}`}>
      <div className="loading-animation">
        <Loading width="100%" height="100%" />
      </div>

      {message && (
        <div className="loading-message">
          <span>
            {message}
            {dots}
          </span>
        </div>
      )}
    </div>
  );
}

export default LoadingPage;
