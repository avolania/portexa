import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["jspdf", "pptxgenjs", "fflate"],
};

export default nextConfig;
