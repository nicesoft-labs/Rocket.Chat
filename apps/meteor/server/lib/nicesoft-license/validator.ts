import { createPublicKey, verify } from 'crypto';

import type { NicesoftLicenseDocument } from '@rocket.chat/core-typings';

export type LicenseValidationErrorKind = 'json' | 'schema' | 'signature' | 'dates';

const DEFAULT_PUBLIC_KEY =
        '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA1JipFWOEwSH7jbgMa2fWAsfjl9GMq73n+0x9HP6U7WQ=\n-----END PUBLIC KEY-----';

export class LicenseValidationError extends Error {
        constructor(
                message: string,
                public readonly kind: LicenseValidationErrorKind,
                public readonly payload?: Partial<NicesoftLicenseDocument>,
        ) {
                super(message);
                this.name = 'LicenseValidationError';
        }
}

const canonicalize = (value: unknown): unknown => {
        if (Array.isArray(value)) {
                return value.map(canonicalize);
        }

        if (value && typeof value === 'object') {
                return Object.keys(value as Record<string, unknown>)
                        .sort()
                        .reduce((result, key) => {
                                (result as Record<string, unknown>)[key] = canonicalize(
                                        (value as Record<string, unknown>)[key],
                                );
                                return result;
                        }, {} as Record<string, unknown>);
        }

        return value;
};

const canonicalizeToString = (value: unknown): string => JSON.stringify(canonicalize(value));

const resolvePublicKey = () => {
        const key = process.env.NICECHAT_LICENSE_PUBLIC_KEY ?? DEFAULT_PUBLIC_KEY;
        if (!key) {
                throw new LicenseValidationError('License public key is not configured', 'signature');
        }

        try {
                return createPublicKey(key);
        } catch (error: any) {
                throw new LicenseValidationError('Invalid license public key', 'signature');
        }
};

const isValidDate = (value: unknown): value is string => {
        if (typeof value !== 'string') {
                return false;
        }

        const date = new Date(value);
        return !Number.isNaN(date.getTime());
};

const assertArrayOfStrings = (value: unknown, field: string): string[] => {
        if (value === undefined) {
                return [];
        }

        if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
                throw new Error(`${field} must be an array of strings`);
        }

        return value as string[];
};

const assertLimitsObject = (value: unknown): Record<string, number> => {
        if (value === undefined) {
                return {};
        }

        if (!value || typeof value !== 'object' || Array.isArray(value)) {
                throw new Error('limits must be an object');
        }

        const entries = Object.entries(value as Record<string, unknown>);
        for (const [key, entryValue] of entries) {
                if (typeof entryValue !== 'number' || Number.isNaN(entryValue)) {
                        throw new Error(`limits.${key} must be a number`);
                }
        }

        return value as Record<string, number>;
};

const assertRequiredString = (value: unknown, field: string): string => {
        if (typeof value !== 'string' || !value.trim()) {
                throw new Error(`${field} is required`);
        }

        return value;
};

const assertOptionalString = (value: unknown, field: string): string | undefined => {
        if (value === undefined) {
                return undefined;
        }

        if (typeof value !== 'string') {
                throw new Error(`${field} must be a string`);
        }

        return value;
};

const assertValidDateRange = (from: string, to: string): void => {
        if (!isValidDate(from) || !isValidDate(to)) {
                throw new Error('valid_from and valid_to must be valid date strings');
        }

        if (new Date(from).getTime() >= new Date(to).getTime()) {
                throw new Error('valid_from must be earlier than valid_to');
        }

        if (new Date(to).getTime() <= Date.now()) {
                throw new Error('License has expired');
        }
};

const verifyLicenseSignature = (document: NicesoftLicenseDocument): void => {
        const { signature, ...payload } = document;
        const canonicalPayload = canonicalizeToString(payload);
        if (!signature) {
                throw new LicenseValidationError('License signature is missing', 'signature', payload);
        }

        const publicKey = resolvePublicKey();
        const isVerified = verify(null, Buffer.from(canonicalPayload), publicKey, Buffer.from(signature, 'base64'));

        if (!isVerified) {
                throw new LicenseValidationError('Invalid license signature', 'signature', payload);
        }
};

export const validateLicenseDocument = (payload: unknown): NicesoftLicenseDocument => {
        if (!payload || typeof payload !== 'object') {
                throw new LicenseValidationError('License payload is empty', 'json');
        }

        const document = payload as Partial<NicesoftLicenseDocument>;

        const product = assertRequiredString(document.product, 'product');
        const edition = assertRequiredString(document.edition, 'edition');
        const tenant = assertOptionalString(document.tenant, 'tenant');
        const valid_from = assertRequiredString(document.valid_from, 'valid_from');
        const valid_to = assertRequiredString(document.valid_to, 'valid_to');
        let signature: string;
        try {
                signature = assertRequiredString(document.signature, 'signature');
        } catch (error: any) {
                throw new LicenseValidationError(error?.message ?? 'Signature is required', 'signature');
        }

        const features = assertArrayOfStrings(document.features, 'features');
        const limits = assertLimitsObject(document.limits);

        const sanitizedDocument: NicesoftLicenseDocument = {
                product,
                edition,
                tenant,
                valid_from,
                valid_to,
                features,
                limits,
                signature,
        };

        try {
                assertValidDateRange(valid_from, valid_to);
        } catch (error: any) {
                throw new LicenseValidationError(error?.message ?? 'Invalid license dates', 'dates', sanitizedDocument);
        }

        verifyLicenseSignature(sanitizedDocument);

        return sanitizedDocument;
};

const decodeJsonString = (raw: string): unknown => {
        try {
                return JSON.parse(raw);
        } catch (error) {
                try {
                        const decoded = Buffer.from(raw, 'base64').toString('utf-8');
                        return JSON.parse(decoded);
                } catch (err) {
                        throw new LicenseValidationError('Invalid license JSON', 'json');
                }
        }
};

export const sanitizeLicensePayload = (document: NicesoftLicenseDocument): Omit<NicesoftLicenseDocument, 'signature'> => {
        const { signature: _signature, ...rest } = document;
        return rest;
};

export const parseLicensePayload = (payload: unknown): NicesoftLicenseDocument => {
        if (payload === undefined || payload === null) {
                throw new LicenseValidationError('License payload is required', 'json');
        }

        const parsedPayload = typeof payload === 'string' ? decodeJsonString(payload) : payload;

        try {
                return validateLicenseDocument(parsedPayload);
        } catch (error: any) {
                if (error instanceof LicenseValidationError) {
                        throw error;
                }

                throw new LicenseValidationError(error?.message ?? 'Invalid license payload', 'schema');
        }
};

