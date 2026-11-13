import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function AuthDialog({ onClose, onDone, reason }: { onClose: () => void; onDone?: () => void; reason?: string }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await useAuth.getState().login(email, password);
      else await useAuth.getState().register(name, email, password);
      toast.success(mode === "login" ? "Sesión iniciada" : "Cuenta creada");
      onDone?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo conectar con el servidor");
    } finally {
      setBusy(false);
    }
  };

  const input = "h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-[13px] outline-none focus:border-neutral-900";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-[16px] font-semibold text-neutral-900">{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h3>
            {reason && <p className="mt-0.5 text-[12px] text-neutral-500">{reason}</p>}
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Cerrar"><X /></Button>
        </div>
        <div className="mb-4 grid grid-cols-2 rounded-lg bg-neutral-100 p-1 text-[12px] font-medium">
          {(["login", "register"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-md py-1.5", mode === m ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500")}>
              {m === "login" ? "Ya tengo cuenta" : "Soy nuevo"}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {mode === "register" && <input className={input} placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoComplete="name" />}
          <input className={input} type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <input className={input} type="password" placeholder={mode === "register" ? "Contraseña (mín. 8 caracteres)" : "Contraseña"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}
        <Button type="submit" className="mt-4 w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} {mode === "login" ? "Entrar" : "Crear cuenta"}
        </Button>
        <p className="mt-3 text-center text-[11px] text-neutral-400">Tus diseños locales siguen guardados en este dispositivo; con una cuenta puedes guardarlos en la nube y hacer pedidos.</p>
      </form>
    </div>
  );
}
