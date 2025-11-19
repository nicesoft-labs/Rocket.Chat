import type { NicesoftLicenseDocument, NicesoftLicenseSource } from '@rocket.chat/core-typings';

export type { NicesoftLicenseDocument };

export type LicenseStatus = 'missing' | 'invalid' | 'valid';

export interface LicenseState {
        status: LicenseStatus;
        valid: boolean;
        payload: NicesoftLicenseDocument | null;
        features: string[];
        limits: Record<string, number>;
        reason: string | null;
        source?: NicesoftLicenseSource;
        filePath?: string;
}
