import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";
import type { VideoSpec } from "../schemas.js";

export type FillAssets = {
  logo: string | null;
  productImage: string | null;
};

export type FillResult = {
  projectDir: string;
  variablesPath: string;
  variables: Record<string, string>;
  brandMarkLocal: string | null;
};

function extOf(file: string): string {
  const ext = path.extname(file).toLowerCase();
  return ext || ".png";
}

function copyTemplate(projectDir: string): void {
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.cpSync(config.paths.templates, projectDir, {
    recursive: true,
    filter: (src) =>
      !src.includes(`${path.sep}.hyperframes${path.sep}`) &&
      !src.endsWith(`${path.sep}.hyperframes`),
  });
}

function stageMark(projectDir: string, absPath: string, destName: string): string {
  const destDir = path.join(projectDir, "assets");
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, destName);
  if (path.resolve(absPath) !== path.resolve(dest)) {
    fs.copyFileSync(absPath, dest);
  }
  return `assets/${destName}`;
}

/**
 * VideoSpec → variables.json + job-local template copy.
 * Official fill path only: no HTML generation.
 */
export function fillTemplate(opts: {
  jobId: string;
  jobDir: string;
  spec: VideoSpec;
  assets: FillAssets;
}): FillResult {
  const projectDir = path.join(opts.jobDir, "project");
  const variablesPath = path.join(opts.jobDir, "variables.json");
  copyTemplate(projectDir);

  const markPath = opts.assets.logo || opts.assets.productImage;
  if (!markPath || !fs.existsSync(markPath)) {
    throw new Error("fillTemplate requires a local logo or product image");
  }
  const destName = opts.assets.logo
    ? `logo${extOf(opts.assets.logo)}`
    : `product${extOf(opts.assets.productImage!)}`;
  const brandMark = stageMark(projectDir, markPath, destName);

  // Also stage product image if present (for future slots); brandMark is what the template binds.
  if (opts.assets.productImage && fs.existsSync(opts.assets.productImage)) {
    stageMark(projectDir, opts.assets.productImage, `product${extOf(opts.assets.productImage)}`);
  }

  const variables: Record<string, string> = {
    locale: String(opts.spec.locale),
    brand: String(opts.spec.brand),
    title: String(opts.spec.title),
    price: String(opts.spec.price ?? ""),
    compareAtPrice: String(opts.spec.compareAtPrice ?? ""),
    headline: String(opts.spec.headline),
    caption1: String(opts.spec.captions[0]),
    caption2: String(opts.spec.captions[1]),
    caption3: String(opts.spec.captions[2]),
    cta: String(opts.spec.cta),
    tagline: String(opts.spec.tagline ?? ""),
    urlHost: String(opts.spec.urlHost),
    background: String(opts.spec.theme.background),
    accent: String(opts.spec.theme.accent),
    brandMark,
  };

  fs.writeFileSync(variablesPath, `${JSON.stringify(variables, null, 2)}\n`);
  return { projectDir, variablesPath, variables, brandMarkLocal: markPath };
}
