import { useState, useSyncExternalStore } from "react";
import { BookmarkPlus, Check, Download, Eraser, FilePlus2, LayoutGrid, Loader2, Redo2, Save, Shield, Undo2 } from "lucide-react";
import { Link } from "react-router";
import { SaveAsTemplateDialog } from "@/components/designs/SaveAsTemplateDialog";
import { ExportDialog } from "./ExportDialog";
import { Images } from "lucide-react";
import { useDesignStudio } from "@/lib/designs/store";
import { toast } from "sonner";
import { useCanRedo, useCanUndo, useDoc, useEditor, useModel } from "@/lib/editor/store";
import { isBlank } from "@/lib/editor/document";
import { localProjectRepository } from "@/lib/editor/persistence";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/field";
import { sceneBridge } from "@/components/viewer/interaction";
import { saveNow, useSaveStatus } from "./hooks";
import { AccountMenu } from "@/components/account/AccountMenu";
import { useIsAdminRole } from "@/lib/api/auth";
import { cn } from "@/lib/utils/cn";

export function TopBar() {
  const doc = useDoc();
  const model = useModel();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const status = useSaveStatus((s) => s.status);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const localAdmin = useIsAdmin();
  const roleAdmin = useIsAdminRole();
  const isAdmin = localAdmin || roleAdmin;
  const s = useEditor.getState;

  const exportPng = async () => {
    if (!sceneBridge.capture) return;
    const url = await sceneBridge.capture();
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.name.replace(/[^\w\- ]+/g, "").trim() || "hecho-a-pie"}.png`;
    a.click();
  };

  const blank = isBlank(doc, model);
  const clearDesign = () => {
    s().clearDesign();
    toast.success("Zapato en blanco", {
      description: "Colores y materiales de fábrica, sin capas.",
      action: { label: "Deshacer", onClick: () => s().undo() },
    });
  };

  const editingId = useDesignStudio((d) => d.editingId);
  const editingPreset = useDesignStudio((d) => (editingId ? d.remote.find((p) => p.id === editingId) : undefined));

  const newDesign = async () => {
    if (!window.confirm("¿Empezar un diseño nuevo? El borrador actual se reemplazará.")) return;
    useDesignStudio.getState().setEditing(null);
    s().newDocument();
    await localProjectRepository.clearDraft();
    toast.success("Nuevo diseño");
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200/80 bg-white px-3 lg:px-4">
      <Link to="/" className="flex items-center gap-2" aria-label="Hecho a Pie, inicio">
        <div className="flex size-8 items-center justify-center rounded-lg bg-neutral-900 text-[11px] font-bold tracking-tight text-white">
          HP
        </div>
        <div className="hidden leading-tight sm:block">
          <div className="text-[13px] font-semibold tracking-tight text-neutral-900">Hecho a Pie</div>
          <div className="text-[10px] text-neutral-400">{model.name}</div>
        </div>
      </Link>

      <div className="mx-1 hidden h-6 w-px bg-neutral-200 sm:block" />

      <NameInput key={doc.name} initial={doc.name} />
      {model.provisional && (
        <span className="hidden md:inline-flex">
          <Badge tone="amber">Modelo provisional</Badge>
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <Button variant="outline" size="sm" className="mr-1 rounded-full" onClick={() => useDesignStudio.getState().setOpen(true)}>
          <LayoutGrid /> <span className="hidden sm:inline">Diseños</span>
        </Button>
        <SaveIndicator status={status} />
        <Tip label="Deshacer (Ctrl+Z)">
          <Button variant="ghost" size="icon" disabled={!canUndo} onClick={() => s().undo()} aria-label="Deshacer">
            <Undo2 />
          </Button>
        </Tip>
        <Tip label="Rehacer (Ctrl+Shift+Z)">
          <Button variant="ghost" size="icon" disabled={!canRedo} onClick={() => s().redo()} aria-label="Rehacer">
            <Redo2 />
          </Button>
        </Tip>
        <div className="mx-1 hidden h-6 w-px bg-neutral-200 sm:block" />
        <Tip label="Dejar en blanco (zapato tal cual, sin diseño)">
          <Button variant="ghost" size="icon" disabled={blank} onClick={clearDesign} aria-label="Dejar en blanco">
            <Eraser />
          </Button>
        </Tip>
        <Tip label="Nuevo diseño">
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={newDesign} aria-label="Nuevo diseño">
            <FilePlus2 />
          </Button>
        </Tip>
        {isAdmin && (
          <>
            <Tip label="Guardar como plantilla (admin)">
              <Button variant="ghost" size="icon" onClick={() => setTemplateOpen(true)} aria-label="Guardar como plantilla">
                <BookmarkPlus />
              </Button>
            </Tip>
            <Tip label="Administrar diseños">
              <Button variant="ghost" size="icon" asChild aria-label="Administrar diseños">
                <Link to="/admin/designs"><Shield /></Link>
              </Button>
            </Tip>
          </>
        )}
        <Tip label="Exportar vistas (hoja de producto)">
          <Button variant="ghost" size="icon" onClick={() => setExportOpen(true)} aria-label="Exportar vistas">
            <Images />
          </Button>
        </Tip>
        <Tip label="Exportar vista PNG">
          <Button variant="ghost" size="icon" onClick={exportPng} aria-label="Exportar PNG">
            <Download />
          </Button>
        </Tip>
        <Button
          size="sm"
          className="ml-1"
          onClick={async () => ((await saveNow()) ? toast.success("Diseño guardado en este dispositivo") : toast.error("No se pudo guardar"))}
        >
          <Save /> <span className="hidden sm:inline">Guardar</span>
        </Button>
        <div className="mx-1 hidden h-6 w-px bg-neutral-200 sm:block" />
        <AccountMenu />
      </div>
      {templateOpen && <SaveAsTemplateDialog onClose={() => setTemplateOpen(false)} existing={editingPreset} />}
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
    </header>
  );
}

/**
 * Modo administrador local (sin backend): se activa con ?admin=1 y se recuerda en localStorage.
 * Con backend, el rol `admin` del usuario autenticado (JWT) también habilita estas acciones;
 * las rutas del API exigen ese rol de todos modos.
 */
function useIsAdmin() {
  return useSyncExternalStore(subscribeAdmin, readAdmin, () => false);
}
function readAdmin() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("admin") === "1") localStorage.setItem("sneakerlab:admin", "1");
  if (params.get("admin") === "0") localStorage.removeItem("sneakerlab:admin");
  return localStorage.getItem("sneakerlab:admin") === "1";
}
function subscribeAdmin(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function SaveIndicator({ status }: { status: string }) {
  const label =
    status === "saving" ? "Guardando…" : status === "saved" ? "Guardado" : status === "error" ? "Error al guardar" : "";
  return (
    <span className={cn("mr-2 hidden items-center gap-1 text-[11px] md:flex", status === "error" ? "text-red-600" : "text-neutral-400")}>
      {status === "saving" || status === "restoring" ? <Loader2 className="size-3 animate-spin" /> : status === "saved" ? <Check className="size-3" /> : null}
      {label}
    </span>
  );
}

/** Se re-monta (key) cuando cambia el nombre en el documento, p. ej. al deshacer. */
function NameInput({ initial }: { initial: string }) {
  const [name, setName] = useState(initial);
  return (
    <input
      value={name}
      maxLength={80}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => name !== initial && useEditor.getState().renameDocument(name)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      aria-label="Nombre del diseño"
      className="min-w-0 max-w-56 flex-1 truncate rounded-md px-2 py-1 text-[13px] font-medium text-neutral-800 outline-none hover:bg-neutral-100 focus:bg-neutral-100"
    />
  );
}
