import type { NicesoftLicenseSource } from '@rocket.chat/core-typings';

export type NicesoftLicenseStatus = 'valid' | 'invalid' | 'missing';

export type NicesoftLicenseInfoResult = {
        status: NicesoftLicenseStatus;
        source: NicesoftLicenseSource | null;
        reason: string | null;
        expiresAt: string | null;
        expiresInSeconds: number | null;
        edition: string | null;
        tenant: string | null;
        features: string[];
        limits: Record<string, number>;
};

export type NicesoftLicenseUploadParams = {
        license: string | Record<string, unknown>;
};

export type NicesoftLicenseEndpoints = {
        '/v1/nicesoft.license.info': {
                GET: () => NicesoftLicenseInfoResult;
        };
        '/v1/nicesoft.license.upload': {
                POST: (params: NicesoftLicenseUploadParams) => NicesoftLicenseInfoResult;
        };
        '/v1/nicesoft.license': {
                DELETE: () => NicesoftLicenseInfoResult;
        };
};
