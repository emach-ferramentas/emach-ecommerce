export interface Product {
	badge?: string;
	category: string;
	categorySlug: string;
	description: string;
	id: string;
	images: string[];
	inStock: boolean;
	name: string;
	originalPrice?: number;
	price: number;
	shortDescription: string;
	sku: string;
	slug: string;
	specs: Record<string, string>;
	voltage?: string[];
}

export interface Category {
	description: string;
	image: string;
	name: string;
	slug: string;
}

export interface CartItem {
	product: Product;
	quantity: number;
	selectedVoltage?: string;
}

export const categories: Category[] = [
	{
		name: "Ferramentas Elétricas",
		slug: "eletricas",
		description: "Furadeiras, serras, esmerilhadeiras e parafusadeiras.",
		image: "/images/categories/eletricas.png",
	},
	{
		name: "Ferramentas Manuais",
		slug: "manuais",
		description: "Chaves, alicates, martelos e serrotes profissionais.",
		image: "/images/categories/manuais.png",
	},
	{
		name: "Medição",
		slug: "medicao",
		description: "Níveis laser, trenas digitais e paquímetros de precisão.",
		image: "/images/categories/medicao.png",
	},
	{
		name: "Segurança",
		slug: "seguranca",
		description: "Óculos, luvas e protetores auriculares certificados.",
		image: "/images/categories/seguranca.png",
	},
	{
		name: "Acessórios",
		slug: "acessorios",
		description: "Brocas, discos de corte, lâminas e bits.",
		image: "/images/categories/acessorios.png",
	},
];

export const products: Product[] = [
	{
		id: "1",
		slug: "furadeira-impacto-20v",
		name: "Furadeira de Impacto 20V",
		category: "Ferramentas Elétricas",
		categorySlug: "eletricas",
		price: 89_900,
		description:
			"Furadeira de impacto profissional com motor brushless de alta eficiência. Mandril de 13mm com aperto rápido, 2 velocidades mecânicas e torque máximo de 60Nm. Ideal para concreto, metal e madeira.",
		shortDescription: "Motor brushless, 60Nm de torque, mandril 13mm.",
		specs: {
			Voltagem: "20V",
			Torque: "60 Nm",
			Velocidade: "0–2.000 RPM",
			Mandril: "13mm",
			Peso: "1.8 kg",
			Bateria: "4.0 Ah Li-Ion",
		},
		images: [
			"/images/products/furadeira-impacto-20v.png",
			"/images/products/furadeira-impacto-20v-gallery.png",
		],
		badge: "Mais Vendido",
		sku: "EMC-FI-2001",
		inStock: true,
		voltage: ["20V"],
	},
	{
		id: "2",
		slug: "serra-circular-185mm",
		name: "Serra Circular 185mm",
		category: "Ferramentas Elétricas",
		categorySlug: "eletricas",
		price: 129_900,
		originalPrice: 149_900,
		description:
			"Serra circular profissional com disco de 185mm e motor de 1.800W. Base em alumínio fundido com ajuste de profundidade e ângulo até 45°. Guia laser integrada para cortes precisos.",
		shortDescription: "1.800W, disco 185mm, guia laser integrada.",
		specs: {
			Potência: "1.800W",
			Disco: "185mm",
			"Profundidade máx.": "65mm a 90°",
			Velocidade: "5.500 RPM",
			Peso: "4.2 kg",
		},
		images: ["/images/products/serra-circular-185mm.png"],
		badge: "Novo",
		sku: "EMC-SC-1851",
		inStock: true,
		voltage: ["110V", "220V"],
	},
	{
		id: "3",
		slug: "esmerilhadeira-angular-125mm",
		name: "Esmerilhadeira Angular 125mm",
		category: "Ferramentas Elétricas",
		categorySlug: "eletricas",
		price: 59_900,
		description:
			"Esmerilhadeira compacta e potente com disco de 125mm. Motor de 1.100W com proteção contra sobrecarga. Empunhadura lateral ajustável em 3 posições.",
		shortDescription: "1.100W, disco 125mm, compacta e ergonômica.",
		specs: {
			Potência: "1.100W",
			Disco: "125mm",
			Velocidade: "11.000 RPM",
			Peso: "2.1 kg",
		},
		images: ["/images/products/esmerilhadeira-125mm.png"],
		sku: "EMC-EA-1251",
		inStock: true,
		voltage: ["110V", "220V"],
	},
	{
		id: "4",
		slug: "parafusadeira-12v-compacta",
		name: "Parafusadeira Compacta 12V",
		category: "Ferramentas Elétricas",
		categorySlug: "eletricas",
		price: 49_900,
		description:
			"Parafusadeira compacta 12V com 20 posições de torque e embreagem eletrônica. Mandril de 10mm, design leve para trabalhos prolongados. Inclui 2 baterias e carregador rápido.",
		shortDescription: "12V, 20 posições de torque, 2 baterias inclusas.",
		specs: {
			Voltagem: "12V",
			Torque: "30 Nm",
			Mandril: "10mm",
			Peso: "0.95 kg",
			Bateria: "2.0 Ah Li-Ion",
		},
		images: ["/images/products/parafusadeira-12v.png"],
		sku: "EMC-PF-1201",
		inStock: true,
		voltage: ["12V"],
	},
	{
		id: "5",
		slug: "jogo-chaves-combinadas-12pcs",
		name: "Jogo de Chaves Combinadas 12 Peças",
		category: "Ferramentas Manuais",
		categorySlug: "manuais",
		price: 18_900,
		description:
			"Jogo de 12 chaves combinadas em aço cromo-vanádio com acabamento espelhado. Medidas de 6mm a 22mm. Estojo organizador em EVA para transporte.",
		shortDescription: "Cromo-vanádio, 6–22mm, estojo EVA.",
		specs: {
			Material: "Cromo-Vanádio",
			Peças: "12",
			Medidas: "6–22mm",
			Acabamento: "Espelhado",
		},
		images: ["/images/products/chaves-combinadas-12pcs.png"],
		sku: "EMC-CC-1201",
		inStock: true,
	},
	{
		id: "6",
		slug: "alicate-universal-8pol",
		name: 'Alicate Universal 8"',
		category: "Ferramentas Manuais",
		categorySlug: "manuais",
		price: 7900,
		description:
			'Alicate universal profissional de 8" em aço especial temperado. Empunhadura bi-material antideslizante com proteção até 1.000V.',
		shortDescription: "Aço temperado, isolamento 1.000V.",
		specs: {
			Tamanho: '8" (200mm)',
			Material: "Aço Especial",
			Isolamento: "1.000V",
			Peso: "0.28 kg",
		},
		images: ["/images/products/alicate-universal-8pol.png"],
		sku: "EMC-AU-0801",
		inStock: true,
	},
	{
		id: "7",
		slug: "nivel-laser-360-verde",
		name: "Nível Laser 360° Verde",
		category: "Medição",
		categorySlug: "medicao",
		price: 79_900,
		originalPrice: 99_900,
		description:
			"Nível laser autonivelante com projeção 360° horizontal e vertical. Laser verde de alta visibilidade, alcance de 30m (60m com detector). Tripé e maleta inclusos.",
		shortDescription: "360° verde, alcance 30m, autonivelante.",
		specs: {
			"Tipo laser": "Verde 520nm",
			Alcance: "30m (60m c/ detector)",
			Precisão: "±1mm/5m",
			Projeção: "360° H + V",
			Bateria: "Li-Ion recarregável",
		},
		images: ["/images/products/nivel-laser-360.png"],
		badge: "Promoção",
		sku: "EMC-NL-3601",
		inStock: true,
	},
	{
		id: "8",
		slug: "trena-digital-laser-50m",
		name: "Trena Digital Laser 50m",
		category: "Medição",
		categorySlug: "medicao",
		price: 29_900,
		description:
			"Trena digital a laser com alcance de 50m e precisão de ±1.5mm. Mede distância, área e volume. Display retroiluminado e memória para 20 medições.",
		shortDescription: "Alcance 50m, precisão ±1.5mm, display LED.",
		specs: {
			Alcance: "50m",
			Precisão: "±1.5mm",
			Funções: "Distância / Área / Volume",
			Display: "LCD retroiluminado",
		},
		images: ["/images/products/trena-digital-50m.png"],
		sku: "EMC-TD-5001",
		inStock: true,
	},
	{
		id: "9",
		slug: "kit-seguranca-profissional",
		name: "Kit Segurança Profissional",
		category: "Segurança",
		categorySlug: "seguranca",
		price: 14_900,
		description:
			"Kit completo com óculos de proteção anti-risco, protetor auricular tipo concha (NRR 25dB) e luvas de alta resistência. Certificação CA.",
		shortDescription: "Óculos + protetor auricular + luvas, certificação CA.",
		specs: {
			Óculos: "Anti-risco, UV400",
			Protetor: "NRR 25dB",
			Luvas: "Resistência mecânica nível 4",
			Certificação: "CA (NR-6)",
		},
		images: ["/images/products/kit-seguranca.png"],
		sku: "EMC-KS-0101",
		inStock: true,
	},
	{
		id: "10",
		slug: "jogo-brocas-hss-25pcs",
		name: "Jogo de Brocas HSS 25 Peças",
		category: "Acessórios",
		categorySlug: "acessorios",
		price: 12_900,
		description:
			"Jogo de 25 brocas HSS com revestimento em titânio para metal, madeira e plástico. Medidas de 1mm a 13mm em estojo metálico organizador.",
		shortDescription: "HSS titânio, 1–13mm, estojo metálico.",
		specs: {
			Material: "HSS Titânio",
			Peças: "25",
			Medidas: "1–13mm",
			Aplicação: "Metal / Madeira / Plástico",
		},
		images: ["/images/products/brocas-hss-25pcs.png"],
		sku: "EMC-BH-2501",
		inStock: true,
	},
	{
		id: "11",
		slug: "disco-corte-metal-115mm-10un",
		name: "Disco de Corte Metal 115mm (10un)",
		category: "Acessórios",
		categorySlug: "acessorios",
		price: 4900,
		description:
			"Pack com 10 discos de corte para metal 115mm x 1.0mm. Alta velocidade de corte com mínima geração de rebarbas.",
		shortDescription: "10 unidades, 115mm, corte rápido.",
		specs: {
			Diâmetro: "115mm",
			Espessura: "1.0mm",
			"RPM máx.": "13.300",
			Quantidade: "10 unidades",
		},
		images: ["/images/products/disco-corte-115mm.png"],
		sku: "EMC-DC-1151",
		inStock: true,
	},
];

export function formatPrice(cents: number): string {
	const reais = cents / 100;
	return reais.toLocaleString("pt-BR", {
		style: "currency",
		currency: "BRL",
	});
}

export function getProductBySlug(slug: string): Product | undefined {
	return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(categorySlug: string): Product[] {
	return products.filter((p) => p.categorySlug === categorySlug);
}

export function getFeaturedProducts(count = 4): Product[] {
	return products.filter((p) => p.badge).slice(0, count);
}
