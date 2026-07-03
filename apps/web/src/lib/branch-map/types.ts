export interface BranchPin {
	address: string;
	city: string;
	id: string;
	mapsUrl: string;
	name: string;
	phone: string | null;
	uf: string;
	x: number;
	y: number;
}

export interface StateShape {
	highlighted: boolean;
	path: string;
	uf: string;
}
