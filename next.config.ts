import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Las fotos ya van comprimidas (~400 KB), pero un lote de varias suma.
      // El default de 1MB no alcanza. Los archivos pasan por el servidor camino
      // a Drive; si algún día un plano supera esto, conviene subir directo a
      // Drive desde el navegador con una URL de subida resumible.
      bodySizeLimit: "40mb",
    },
  },
};

export default nextConfig;
