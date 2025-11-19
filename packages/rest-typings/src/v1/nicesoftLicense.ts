import type { NicesoftLicenseSource } from '@rocket.chat/core-typings';

export type NicesoftLicenseStatus = 'valid' | 'invalid' | 'missing';

export type NicesoftLicensePayload = {
        product: string | null;
        edition: string | null;
        tenant?: any;
        valid_from?: string | null;
        valid_to?: string | null;
        features: string[];
        limits: Record<string, number>;
        grace?: boolean;
};

export type NicesoftLicenseInfoResult = {
        status: NicesoftLicenseStatus;
        source: NicesoftLicenseSource | null;
        reason: string | null;
        expires_in: number | null;
        payload: NicesoftLicensePayload;
};

export type NicesoftLicenseUploadParams = FormData | { license: string | Record<string, unknown> };

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
