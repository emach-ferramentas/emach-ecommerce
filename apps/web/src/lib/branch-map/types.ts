export type BranchPin = {
	id: string;
	name: string;
	city: string;
	uf: string;
	address: string;
	phone: string | null;
	x: number;
	y: number;
	mapsUrl: string;
};

export type StateShape = { uf: string; path: string; highlighted: boolean };
