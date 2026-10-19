import React, { useState, useEffect } from "react";
import { Eye, EyeOff, ShieldCheck, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { maskRut, maskName, maskEmail, maskPhone, formatRut, type RutMaskMode } from "@/lib/rut";

interface PrivacyShieldProps {
  value: string | null | undefined;
  type?: "rut" | "name" | "email" | "phone" | "text";
  rutMode?: RutMaskMode;
  nameMode?: "first_initial" | "asterisks" | "initials";
  revealable?: boolean;
  autoHideMs?: number;
  className?: string;
  badgeClassName?: string;
  copyable?: boolean;
  label?: string;
}

/**
 * Componente UI de Seguridad y Privacidad de Datos Sensibles (PIE, Menores y Apoderados).
 * Oculta el dato por defecto para evitar fugas visuales (shoulder-surfing, grabaciones, proyectores)
 * y permite revelar el valor de forma controlada y temporal con re-ocultamiento automático.
 */
export function PrivacyShield({
  value,
  type = "rut",
  rutMode = "banco",
  nameMode = "first_initial",
  revealable = true,
  autoHideMs = 8000,
  className = "",
  badgeClassName = "",
  copyable = false,
  label,
}: PrivacyShieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (revealed && autoHideMs > 0) {
      const timer = setTimeout(() => {
        setRevealed(false);
      }, autoHideMs);
      return () => clearTimeout(timer);
    }
  }, [revealed, autoHideMs]);

  if (!value) {
    return <span className={`text-muted-foreground ${className}`}>—</span>;
  }

  let formattedValue = value;
  let maskedValue = value;

  if (type === "rut") {
    formattedValue = formatRut(value);
    maskedValue = maskRut(value, rutMode);
  } else if (type === "name") {
    maskedValue = maskName(value, nameMode);
  } else if (type === "email") {
    maskedValue = maskEmail(value);
  } else if (type === "phone") {
    maskedValue = maskPhone(value);
  } else {
    // Generico texto
    maskedValue = value.length > 4 ? `${value.slice(0, 2)}****${value.slice(-2)}` : "****";
  }

  const displayedText = revealed ? formattedValue : maskedValue;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(formattedValue);
      setCopied(true);
      toast.success("Copiado al portapapeles", {
        description: label ? `${label} copiado de forma segura` : undefined,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-xs select-none ${className}`}
      title={revealed ? "Dato revelado temporalmente" : "Dato protegido por privacidad"}
    >
      <span
        className={`px-1.5 py-0.5 rounded transition-colors ${
          revealed
            ? "bg-amber-500/10 text-amber-500 font-semibold border border-amber-500/30"
            : "bg-surface-2/80 text-foreground border border-border/70"
        } ${badgeClassName}`}
      >
        {displayedText}
      </span>

      {revealable && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setRevealed((prev) => !prev);
          }}
          className="p-1 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title={revealed ? "Ocultar dato sensible" : "Mostrar dato completo (temporal)"}
          aria-label={revealed ? "Ocultar" : "Mostrar"}
        >
          {revealed ? (
            <EyeOff className="w-3.5 h-3.5 text-amber-500" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </button>
      )}

      {copyable && revealed && (
        <button
          type="button"
          onClick={handleCopy}
          className="p-1 rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Copiar dato completo"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </span>
  );
}
