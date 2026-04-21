import type { Kysely } from "kysely";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { handleContentCreate } from "../../src/api/index.js";
import type { Database } from "../../src/database/types.js";
import { emdashLoader } from "../../src/loader.js";
import { runWithContext } from "../../src/request-context.js";
import { SchemaRegistry } from "../../src/schema/registry.js";
import { setupTestDatabaseWithCollections, teardownTestDatabase } from "../utils/test-db.js";

describe("Loader media src", () => {
	let db: Kysely<Database>;

	beforeEach(async () => {
		db = await setupTestDatabaseWithCollections();
		const registry = new SchemaRegistry(db);
		await registry.createField("post", {
			slug: "hero",
			label: "Hero",
			type: "image",
		});
	});

	afterEach(async () => {
		await teardownTestDatabase(db);
	});

	it("resolves bare media ID in src to a file URL", async () => {
		await handleContentCreate(db, "post", {
			data: {
				title: "Test",
				hero: { provider: "local", id: "", src: "01KPD97MWB5DVHBHK69TW55KY3" },
			},
			status: "published",
		});

		const loader = emdashLoader();
		const result = await runWithContext({ editMode: false, db }, () =>
			loader.loadCollection!({ filter: { type: "post" } }),
		);

		const hero = result.entries![0]!.data.hero as Record<string, unknown>;
		expect(hero.src).toBe("/_emdash/api/media/file/01KPD97MWB5DVHBHK69TW55KY3");
	});
});
