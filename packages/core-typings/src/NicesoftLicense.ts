export type NicesoftLicenseSource = 'env' | 'file' | 'db';

export interface NicesoftLicenseDocument {
        product: string;
        edition: string;
        tenant?: string;
        valid_from?: string;
        valid_to?: string;
        features?: string[];
        limits?: Record<string, number>;
}
