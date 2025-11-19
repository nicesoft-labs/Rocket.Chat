import type { NicesoftLicenseSource } from '@rocket.chat/core-typings';

import { promises as fs } from 'fs';

const DEFAULT_LICENSE_PATH = '/etc/nicechat/license.json';
const ENV_LICENSE_B64 = 'NICECHAT_LICENSE_B64';
const ENV_LICENSE_PATH = 'NICECHAT_LICENSE_PATH';

export type LicenseSource = NicesoftLicenseSource;

export interface LicenseStorageResult {
	source: LicenseSource;
	content: string;
	path?: string;
}

const decodeBase64 = (value: string): string => {
	try {
		return Buffer.from(value, 'base64').toString('utf-8');
	} catch (error) {
		throw new Error('Failed to decode license from environment variable');
	}
};

export const readLicenseFromEnv = (): LicenseStorageResult | null => {
	const raw = process.env[ENV_LICENSE_B64];
	if (!raw) {
		return null;
	}

	const content = decodeBase64(raw);
	return {
		source: 'env',
		content,
	};
};

export const getLicenseFilePath = (): string => process.env[ENV_LICENSE_PATH] ?? DEFAULT_LICENSE_PATH;

export const readLicenseFromFile = async (): Promise<LicenseStorageResult | null> => {
	const path = getLicenseFilePath();
	try {
		const content = await fs.readFile(path, 'utf-8');
		return {
			source: 'file',
			content,
			path,
		};
	} catch (error: any) {
		if (error && (error.code === 'ENOENT' || /no such file/i.test(String(error.message)))) {
			return null;
		}

		throw new Error(`Failed to read license file at ${path}: ${error?.message ?? error}`);
	}
};

export const loadLicenseFromStorage = async (): Promise<LicenseStorageResult | null> => {
	const envResult = readLicenseFromEnv();
	if (envResult) {
		return envResult;
	}

	return readLicenseFromFile();
};
