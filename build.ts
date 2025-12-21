import type { BuildConfig } from "bun";

const config: BuildConfig = {
  entrypoints: ["./src/index.tsx"],
  outdir: "./dist",
  minify: true,
  sourcemap: "none",
  splitting: false, // Desactivar splitting por ahora para tener un solo archivo sólido
  naming: {
    entry: "index.js",
    chunk: "[name]-[hash].[ext]",
    asset: "[name]-[hash].[ext]",
  },
};

try {
  console.log("Building frontend with Bun...");
  console.log("Config:", JSON.stringify(config, null, 2));
  const result = await Bun.build(config);

  if (!result.success) {
    console.error("Build failed with errors:");
    for (const message of result.logs) {
      console.error(message);
    }
    process.exit(1);
  }

  console.log("Build successful!");
  console.log("Outputs:", result.outputs.map(o => o.path).join(", "));

  // Copy index.html to dist
  const indexHtml = await Bun.file("index.html").text();
  const finalHtml = indexHtml.replace('src="/src/index.tsx"', 'src="/index.js"');

  await Bun.write("dist/index.html", finalHtml);
  console.log("Copied index.html to dist/index.html");
} catch (err) {
  console.error("Unexpected error during build:");
  console.error(err);
  process.exit(1);
}
