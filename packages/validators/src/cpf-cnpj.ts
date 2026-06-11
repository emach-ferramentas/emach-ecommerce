const RE_DIGITS = /\D/g;
const RE_NON_LETTERS = /[^\p{L}\s'-]/gu;
const RE_CPF_A = /^(\d{3})(\d)/;
const RE_CPF_B = /^(\d{3})\.(\d{3})(\d)/;
const RE_CPF_C = /\.(\d{3})(\d)/;
const RE_CNPJ_A = /^(\d{2})(\d)/;
const RE_CNPJ_B = /^(\d{2})\.(\d{3})(\d)/;
const RE_CNPJ_C = /\.(\d{3})(\d)/;
const RE_CNPJ_D = /(\d{4})(\d)/;
const RE_PHONE_A = /^(\d{2})(\d)/;
const RE_PHONE_B10 = /(\d{4})(\d)/;
const RE_PHONE_B11 = /(\d{5})(\d)/;

export const onlyDigits = (v: string): string => v.replace(RE_DIGITS, "");

export const onlyLetters = (v: string): string => v.replace(RE_NON_LETTERS, "");

const allSame = (digits: string): boolean =>
	digits.length > 0 && digits.split("").every((d) => d === digits[0]);

const cpfCheck = (digits: string, length: number): number => {
	let sum = 0;
	for (let i = 0; i < length; i++) {
		sum += Number(digits[i]) * (length + 1 - i);
	}
	const rest = (sum * 10) % 11;
	return rest === 10 ? 0 : rest;
};

export const isValidCpf = (raw: string): boolean => {
	const d = onlyDigits(raw);
	if (d.length !== 11 || allSame(d)) {
		return false;
	}
	if (cpfCheck(d, 9) !== Number(d[9])) {
		return false;
	}
	return cpfCheck(d, 10) === Number(d[10]);
};

const CNPJ_WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

const cnpjCheck = (digits: string, weights: number[]): number => {
	let sum = 0;
	for (let i = 0; i < weights.length; i++) {
		sum += Number(digits[i]) * (weights[i] ?? 0);
	}
	const rest = sum % 11;
	return rest < 2 ? 0 : 11 - rest;
};

export const isValidCnpj = (raw: string): boolean => {
	const d = onlyDigits(raw);
	if (d.length !== 14 || allSame(d)) {
		return false;
	}
	if (cnpjCheck(d, CNPJ_WEIGHTS_1) !== Number(d[12])) {
		return false;
	}
	return cnpjCheck(d, CNPJ_WEIGHTS_2) === Number(d[13]);
};

export const isValidCpfCnpj = (raw: string): boolean => {
	const d = onlyDigits(raw);
	if (d.length === 11) {
		return isValidCpf(d);
	}
	if (d.length === 14) {
		return isValidCnpj(d);
	}
	return false;
};

export const isValidPhone = (raw: string): boolean => {
	const d = onlyDigits(raw);
	if (d.length !== 10 && d.length !== 11) {
		return false;
	}
	if (allSame(d)) {
		return false;
	}
	const ddd = Number(d.slice(0, 2));
	if (ddd < 11 || ddd > 99) {
		return false;
	}
	// Celular (11 dígitos): 3º dígito é sempre 9 (regra ANATEL).
	if (d.length === 11 && d[2] !== "9") {
		return false;
	}
	return true;
};

export const maskCpfCnpj = (raw: string): string => {
	const d = onlyDigits(raw).slice(0, 14);
	if (d.length <= 11) {
		return d
			.replace(RE_CPF_A, "$1.$2")
			.replace(RE_CPF_B, "$1.$2.$3")
			.replace(RE_CPF_C, ".$1-$2");
	}
	return d
		.replace(RE_CNPJ_A, "$1.$2")
		.replace(RE_CNPJ_B, "$1.$2.$3")
		.replace(RE_CNPJ_C, ".$1/$2")
		.replace(RE_CNPJ_D, "$1-$2");
};

export const maskPhone = (raw: string): string => {
	const d = onlyDigits(raw).slice(0, 11);
	if (d.length <= 10) {
		return d.replace(RE_PHONE_A, "($1) $2").replace(RE_PHONE_B10, "$1-$2");
	}
	return d.replace(RE_PHONE_A, "($1) $2").replace(RE_PHONE_B11, "$1-$2");
};
