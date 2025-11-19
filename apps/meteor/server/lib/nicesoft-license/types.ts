export interface NicesoftLicenseDocument {
	product: string;
	edition: string;
	valid_from?: string;
	valid_to?: string;
	features?: string[];
	limits?: Record<string, number>;
}

export interface LicenseState {
	valid: boolean;
	payload?: NicesoftLicenseDocument;
	reason?: string;
	source?: 'env' | 'file';
}
