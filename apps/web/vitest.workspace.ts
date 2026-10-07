import {
	configDefaults,
	defineWorkspace,
	type UserWorkspaceConfig,
} from "vitest/config";
import { INTEGRATION } from "./vitest.config";

type Project = UserWorkspaceConfig & { extends: string };

export function workspaceProjects({
	unitOnly,
}: {
	unitOnly: boolean;
}): Project[] {
	const unit: Project = {
		extends: "./vitest.config.ts",
		test: {
			name: "unit",
			exclude: [...configDefaults.exclude, ...INTEGRATION],
		},
	};
	const integration: Project = {
		extends: "./vitest.config.ts",
		test: {
			name: "integration",
			include: INTEGRATION,
			// No vitest 2.1 o pool lê `fileParallelism` só da raiz; `singleFork`
			// vale por projeto e roda esta lista num fork, um arquivo por vez.
			poolOptions: { forks: { singleFork: true } },
		},
	};
	return unitOnly ? [unit] : [unit, integration];
}

export default defineWorkspace(
	workspaceProjects({ unitOnly: process.env.VITEST_UNIT_ONLY === "1" })
);
