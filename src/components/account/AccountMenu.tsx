import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronDown, CloudUpload, FolderOpen, LogIn, LogOut, Package, Shield, Tags, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/api/auth";
import { AuthDialog } from "./AuthDialog";
import { CloudDesignsDialog, saveToCloud } from "./CloudDesignsDialog";
import { Button } from "@/components/ui/button";

export function AccountMenu() {
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState(false);
  const [designs, setDesigns] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { void useAuth.getState().hydrate(); }, []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (status === "offline") return null;

  if (!user) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => setAuth(true)}>
          <LogIn /> <span className="hidden sm:inline">Entrar</span>
        </Button>
        {auth && <AuthDialog onClose={() => setAuth(false)} />}
      </>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const d = await saveToCloud();
      toast.success(`"${d.name}" guardado en tu cuenta`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar en la nube");
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-neutral-700 hover:bg-neutral-100";
  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="flex size-6 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white">{user.name.slice(0, 1).toUpperCase()}</span>
        <span className="hidden max-w-28 truncate sm:inline">{user.name}</span>
        <ChevronDown className="size-3.5" />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-60 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg">
          <div className="px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-neutral-900"><UserRound className="size-3.5" /> {user.name}</div>
            <div className="truncate text-[11px] text-neutral-400">{user.email}{user.role === "admin" ? " · admin" : ""}</div>
          </div>
          <div className="my-1 h-px bg-neutral-100" />
          <button role="menuitem" className={item} onClick={save} disabled={saving}><CloudUpload className="size-4" /> {saving ? "Guardando…" : "Guardar en mi cuenta"}</button>
          <button role="menuitem" className={item} onClick={() => { setDesigns(true); setOpen(false); }}><FolderOpen className="size-4" /> Mis diseños</button>
          <Link role="menuitem" className={item} to="/orders" onClick={() => setOpen(false)}><Package className="size-4" /> Mis pedidos</Link>
          {user.role === "admin" && (
            <>
              <div className="my-1 h-px bg-neutral-100" />
              <Link role="menuitem" className={item} to="/admin/orders" onClick={() => setOpen(false)}><Shield className="size-4" /> Pedidos (admin)</Link>
              <Link role="menuitem" className={item} to="/admin/pricing" onClick={() => setOpen(false)}><Tags className="size-4" /> Precios (admin)</Link>
            </>
          )}
          <div className="my-1 h-px bg-neutral-100" />
          <button role="menuitem" className={item} onClick={() => { useAuth.getState().logout(); setOpen(false); toast("Sesión cerrada"); }}><LogOut className="size-4" /> Salir</button>
        </div>
      )}
      {designs && <CloudDesignsDialog onClose={() => setDesigns(false)} />}
    </div>
  );
}
