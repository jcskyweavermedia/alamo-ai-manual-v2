import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/hooks/use-language";

const STRINGS = {
  en: {
    heading: 'Oops! Page not found',
    returnHome: 'Return to Home',
  },
  es: {
    heading: '\u00a1P\u00e1gina no encontrada!',
    returnHome: 'Volver al Inicio',
  },
} as const;

const NotFound = () => {
  const location = useLocation();
  const { language } = useLanguage();
  const t = STRINGS[language];

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">{t.heading}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {t.returnHome}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
