import Database from "better-sqlite3";
import { SqliteDialect } from "kysely";
import { afterEach, describe, expect, it } from "vitest";

import type { EmDashManifest } from "../../../src/astro/types.js";
import { OptionsRepository } from "../../../src/database/repositories/options.js";
import { EmDashRuntime, type RuntimeDependencies } from "../../../src/emdash-runtime.js";
import { definePlugin } from "../../../src/plugins/define-plugin.js";
import type { ResolvedPlugin } from "../../../src/plugins/types.js";

const PLUGIN_ID = "emdash-plugin-cache-key-test";

let testId = 0;
let sqliteDb: Database.Database | null = null;
let runtimeDb: EmDashRuntime["db"] | null = null;

function makePlugin({
	capabilities = [],
	blockLabel = "Callout",
}: {
	capabilities?: ResolvedPlugin["capabilities"];
	blockLabel?: string;
} = {}): ResolvedPlugin {
	return definePlugin({
		id: PLUGIN_ID,
		version: "0.1.0",
		capabilities,
		admin: {
			pages: [{ path: "/settings", label: "Settings", icon: "settings" }],
			portableTextBlocks: [
				{
					type: "callout",
					label: blockLabel,
				},
			],
		},
	});
}

function createRuntimeDeps(plugin: ResolvedPlugin): RuntimeDependencies {
	sqliteDb ??= new Database(":memory:");

	return {
		config: {
			database: {
				entrypoint: `manifest-cache-key-test-${testId}`,
				config: {},
				type: "sqlite",
			},
		},
		plugins: [plugin],
		createDialect: () => new SqliteDialect({ database: sqliteDb! }),
		createStorage: null,
		sandboxEnabled: false,
		mediaProviderEntries: [],
		sandboxedPluginEntries: [],
		createSandboxRunner: null,
	};
}

async function createRuntime(plugin: ResolvedPlugin): Promise<EmDashRuntime> {
	const runtime = await EmDashRuntime.create(createRuntimeDeps(plugin));
	runtimeDb = runtime.db;
	return runtime;
}

function staleManifest(): EmDashManifest {
	return {
		version: "0.6.0",
		hash: "stale-hash",
		collections: {},
		plugins: {
			[PLUGIN_ID]: {
				version: "0.1.0",
				enabled: true,
				adminMode: "blocks",
				adminPages: [{ path: "/settings", label: "Stale settings", icon: "settings" }],
				dashboardWidgets: [],
				portableTextBlocks: [{ type: "callout", label: "Stale block" }],
			},
		},
		authMode: "passkey",
		taxonomies: [],
	};
}

async function seedStaleManifestCache(plugin: ResolvedPlugin): Promise<void> {
	const runtime = await createRuntime(plugin);
	await runtime.getManifest();

	const options = new OptionsRepository(runtime.db);
	const cached = await options.get<{ key: string; manifest: EmDashManifest }>(
		"emdash:manifest_cache",
	);
	expect(cached?.key).toBeTruthy();

	await options.set("emdash:manifest_cache", {
		key: cached!.key,
		manifest: staleManifest(),
	});
}

describe("manifest cache key", () => {
	afterEach(async () => {
		await runtimeDb?.destroy();
		runtimeDb = null;
		sqliteDb?.close();
		sqliteDb = null;
		testId += 1;
	});

	it("preserves the persisted cache when plugin manifest config is unchanged", async () => {
		const plugin = makePlugin();
		await seedStaleManifestCache(plugin);

		const runtime = await createRuntime(plugin);
		const manifest = await runtime.getManifest();

		expect(manifest.plugins[PLUGIN_ID]?.portableTextBlocks?.[0]?.label).toBe("Stale block");
	});

	it("busts the persisted cache when admin portableTextBlocks changes", async () => {
		const oldPlugin = makePlugin({ blockLabel: "Callout" });
		const newPlugin = makePlugin({ blockLabel: "Aside" });
		await seedStaleManifestCache(oldPlugin);

		const runtime = await createRuntime(newPlugin);
		const manifest = await runtime.getManifest();

		expect(manifest.plugins[PLUGIN_ID]?.portableTextBlocks?.[0]?.label).toBe("Aside");
	});

	it("busts the persisted cache when plugin capabilities change", async () => {
		const oldPlugin = makePlugin({ capabilities: [] });
		const newPlugin = makePlugin({ capabilities: ["read:content"] });
		await seedStaleManifestCache(oldPlugin);

		const runtime = await createRuntime(newPlugin);
		const manifest = await runtime.getManifest();

		expect(manifest.plugins[PLUGIN_ID]?.portableTextBlocks?.[0]?.label).toBe("Callout");
	});
});
