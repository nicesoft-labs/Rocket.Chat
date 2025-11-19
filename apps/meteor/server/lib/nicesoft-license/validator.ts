import type { NicesoftLicenseDocument } from '@rocket.chat/core-typings';

const isValidDate = (value: unknown): value is string => {
        if (typeof value !== 'string') {
                return false;
        }

        const date = new Date(value);
        return !Number.isNaN(date.getTime());
};

const assertArrayOfStrings = (value: unknown, field: string): string[] => {
        if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
                throw new Error(`${field} must be an array of strings`);
        }

        return value as string[];
};

const assertLimitsObject = (value: unknown): Record<string, number> => {
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

const assertValidDateRange = (from: string, to: string): void => {
        if (!isValidDate(from) || !isValidDate(to)) {
                throw new Error('valid_from and valid_to must be valid date strings');
        }

        if (new Date(from).getTime() >= new Date(to).getTime()) {
                throw new Error('valid_from must be earlier than valid_to');
        }
};

export const validateLicenseDocument = (payload: unknown): NicesoftLicenseDocument => {
        if (!payload || typeof payload !== 'object') {
                throw new Error('License payload is empty');
        }

        const document = payload as Partial<NicesoftLicenseDocument>;

        const product = assertRequiredString(document.product, 'product');
        const edition = assertRequiredString(document.edition, 'edition');
        const valid_from = assertRequiredString(document.valid_from, 'valid_from');
        const valid_to = assertRequiredString(document.valid_to, 'valid_to');

        assertValidDateRange(valid_from, valid_to);

        const features = assertArrayOfStrings(document.features, 'features');
        const limits = assertLimitsObject(document.limits);

        return {
                ...document,
                product,
                edition,
                valid_from,
                valid_to,
                features,
                limits,
        } as NicesoftLicenseDocument;
};

