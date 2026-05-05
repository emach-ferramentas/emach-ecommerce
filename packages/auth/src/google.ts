interface GoogleProviderEnv {
	clientId: string;
	clientSecret: string;
}

export const createGoogleProviderConfig = ({
	clientId,
	clientSecret,
}: GoogleProviderEnv) => ({
	clientId,
	clientSecret,
	prompt: "select_account" as const,
});
