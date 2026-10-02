import { describe, expect, it } from "vitest";
import { buildSlots, slotKey } from "./gallery-slots";

const imgs = [{ url: "a.jpg" }, { url: "b.jpg" }, { url: "c.jpg" }];

describe("buildSlots", () => {
	it("sem vídeo retorna só imagens na mesma ordem", () => {
		expect(buildSlots(imgs, null)).toEqual([
			{ kind: "image", url: "a.jpg" },
			{ kind: "image", url: "b.jpg" },
			{ kind: "image", url: "c.jpg" },
		]);
	});

	it("trata video undefined igual a null", () => {
		expect(buildSlots(imgs, undefined)).toEqual([
			{ kind: "image", url: "a.jpg" },
			{ kind: "image", url: "b.jpg" },
			{ kind: "image", url: "c.jpg" },
		]);
	});

	it("insere o vídeo logo após a 1ª imagem", () => {
		expect(buildSlots(imgs, { url: "v.mp4", poster: "p.jpg" })).toEqual([
			{ kind: "image", url: "a.jpg" },
			{ kind: "video", url: "v.mp4", poster: "p.jpg" },
			{ kind: "image", url: "b.jpg" },
			{ kind: "image", url: "c.jpg" },
		]);
	});

	it("vídeo sem nenhuma imagem é o único slot", () => {
		expect(buildSlots([], { url: "v.mp4", poster: "p.jpg" })).toEqual([
			{ kind: "video", url: "v.mp4", poster: "p.jpg" },
		]);
	});

	it("sem imagens e sem vídeo retorna lista vazia", () => {
		expect(buildSlots([], null)).toEqual([]);
	});

	it("preserva poster null no slot de vídeo", () => {
		expect(buildSlots(imgs, { url: "v.mp4", poster: null })).toEqual([
			{ kind: "image", url: "a.jpg" },
			{ kind: "video", url: "v.mp4", poster: null },
			{ kind: "image", url: "b.jpg" },
			{ kind: "image", url: "c.jpg" },
		]);
	});
});

describe("slotKey", () => {
	it("imagem usa prefixo image-", () => {
		expect(slotKey({ kind: "image", url: "a.jpg" })).toBe("image-a.jpg");
	});
	it("vídeo usa prefixo video-", () => {
		expect(slotKey({ kind: "video", url: "v.mp4", poster: null })).toBe(
			"video-v.mp4"
		);
	});
});
