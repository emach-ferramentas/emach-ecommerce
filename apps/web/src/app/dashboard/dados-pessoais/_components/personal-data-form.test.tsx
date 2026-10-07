// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PersonalDataForm } from "./personal-data-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/auth-client", () => ({ authClient: {} }));

const renderWithDocument = (document: string | null) =>
	renderToStaticMarkup(
		<PersonalDataForm
			initialData={{
				document,
				email: "ana@example.com",
				emailVerified: true,
				name: "Ana",
				phone: null,
			}}
		/>
	);

describe("PersonalDataForm: documento", () => {
	it("mostra CNPJ alfanumérico mascarado", () => {
		expect(renderWithDocument("12ABC34501DE35")).toContain(
			"12.ABC.345/01DE-35"
		);
	});

	it("mostra CPF mascarado", () => {
		expect(renderWithDocument("52998224725")).toContain("529.982.247-25");
	});
});
