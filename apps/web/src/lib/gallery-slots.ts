export type GallerySlot =
	| { kind: "image"; url: string }
	| { kind: "video"; url: string; poster: string | null };

export function slotKey(slot: GallerySlot): string {
	return slot.kind === "video" ? `video-${slot.url}` : `image-${slot.url}`;
}

export function buildSlots(
	images: { url: string }[],
	video: { url: string; poster: string | null } | null | undefined
): GallerySlot[] {
	const imageSlots: GallerySlot[] = images.map((i) => ({
		kind: "image",
		url: i.url,
	}));

	if (!video) {
		return imageSlots;
	}

	const videoSlot: GallerySlot = {
		kind: "video",
		url: video.url,
		poster: video.poster,
	};

	if (imageSlots.length === 0) {
		return [videoSlot];
	}

	return [imageSlots[0], videoSlot, ...imageSlots.slice(1)];
}
