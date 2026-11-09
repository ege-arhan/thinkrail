import { renameSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { posthogSourceMapUpload, sourceMapRelease } from "./sourceMapUpload";

const hostPort = process.env.THINKRAIL_PORT ?? 24242;

function phoneEntryAsIndex(): Plugin {
	return {
		name: "thinkrail-phone-entry-as-index",
		enforce: "post",
		writeBundle(options) {
			const dir = options.dir ?? "dist-phone";
			renameSync(join(dir, "phone.html"), join(dir, "index.html"));
		},
	};
}

export default defineConfig(({ mode }) => {
	const profile = mode === "profile";
	const phone = mode === "phone";
	const release = profile || phone ? null : sourceMapRelease();
	return {
		plugins: [
			react(),
			babel({ presets: [reactCompilerPreset()] }),
			tailwindcss(),
			...(release ? [posthogSourceMapUpload(release)] : []),
			...(phone ? [phoneEntryAsIndex()] : []),
		],
		resolve: {
			alias: [
				{ find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
				...(profile ? [{ find: /^react-dom\/client$/, replacement: "react-dom/profiling" }] : []),
			],
		},
		server: {
			port: Number(process.env.THINKRAIL_WEB_PORT ?? 24269),
			strictPort: process.env.THINKRAIL_WEB_PORT !== undefined,
			proxy: {
				"/ws": {
					target: `ws://localhost:${hostPort}`,
					ws: true,
				},
				"/files": { target: `http://localhost:${hostPort}` },
				"/blob": { target: `http://localhost:${hostPort}` },
				"/fonts": { target: `http://localhost:${hostPort}` },
			},
		},
		worker: { format: "es" },
		build: profile
			? { outDir: "dist-profile", minify: false }
			: phone
				? { outDir: "dist-phone", rollupOptions: { input: "phone.html" } }
				: { outDir: "dist", ...(release ? { sourcemap: "hidden" as const } : {}) },
	};
});
