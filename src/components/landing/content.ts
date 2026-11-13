/**
 * Textos compartidos por la landing, los metadatos por ruta y el prerender (scripts/prerender.mjs),
 * que genera con ellos el JSON-LD. Sin dependencias: se importa también desde Node.
 */

export const BRAND = "Hecho a Pie";

export interface PageSeo {
  title: string;
  description: string;
  index: boolean;
}

export const SEO = {
  home: {
    title: "Zapatillas personalizadas diseñadas en 3D | Hecho a Pie",
    description:
      "Diseña tus zapatillas personalizadas en 3D: elige colores, materiales, ilustraciones y textos en cada zona, mira el precio al instante y pídelas hechas a tu medida.",
    index: true,
  },
  editor: {
    title: "Diseña tus zapatillas en 3D | Hecho a Pie",
    description: "Editor 3D de Hecho a Pie: personaliza cada zona de tus zapatillas con colores, materiales, imágenes y textos, y mira el precio al momento.",
    // Vista de aplicación sin contenido rastreable: se sirve con app.html (noindex).
    index: false,
  },
  private: (title: string): PageSeo => ({ title: `${title} | Hecho a Pie`, description: "Área privada de Hecho a Pie.", index: false }),
} satisfies Record<string, PageSeo | ((t: string) => PageSeo)>;

export const FAQ = [
  { q: "¿Necesito saber diseñar?", a: "No. Puedes partir de uno de nuestros diseños y cambiar solo los colores, o empezar desde cero. El editor funciona en el navegador, también en el móvil." },
  { q: "¿Puedo usar mis propias imágenes?", a: "Sí. Sube tus ilustraciones o fotos y colócalas en las zonas imprimibles (puntera, laterales, talón y lengüeta). Asegúrate de tener derecho a usarlas." },
  { q: "¿Cuándo sé cuánto cuestan mis zapatillas?", a: "Desde el primer momento: el precio se calcula mientras diseñas según las zonas, capas, materiales y extras que elijas, y se fija en la cotización antes de confirmar el pedido." },
  { q: "¿Qué extras hay?", a: "Acabado protector mate o brillante, caja de regalo y producción exprés. Los eliges al hacer el pedido." },
  { q: "¿Pierdo mi diseño si cierro la página?", a: "No. El borrador se guarda automáticamente en tu navegador. Si creas una cuenta, además lo tienes en la nube y puedes compartirlo." },
];
