import type { NicesoftLicenseSource } from '@rocket.chat/core-typings';

import { promises as fs } from 'fs';
import { Mongo } from 'meteor/mongo';
import { dirname } from 'path';

const DEFAULT_LICENSE_PATH = '/etc/nicechat/license.json';
const ENV_LICENSE_B64 = 'NICECHAT_LICENSE_B64';
const ENV_LICENSE_PATH = 'NICECHAT_LICENSE_PATH';
const DB_LICENSE_ID = 'nicesoft-license';

export type LicenseSource = NicesoftLicenseSource;

export interface LicenseStorageResult {
        source: LicenseSource;
        content: string;
        path?: string;
}

const collection = new Mongo.Collection<{ _id: string; content: string }>('nicesoft_license');

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

export const persistLicenseToFile = async (content: string): Promise<string> => {
        const path = getLicenseFilePath();
        await fs.mkdir(dirname(path), { recursive: true });
        await fs.writeFile(path, content, 'utf-8');
        return path;
};

export const persistLicenseToDatabase = async (content: string): Promise<void> => {
        await collection.rawCollection().updateOne({ _id: DB_LICENSE_ID }, { $set: { content } }, { upsert: true });
};

export const removeLicenseFile = async (): Promise<void> => {
        const path = getLicenseFilePath();
        try {
                await fs.unlink(path);
        } catch (error: any) {
                if (error?.code === 'ENOENT') {
                        return;
                }

                throw new Error(`Failed to remove license file at ${path}: ${error?.message ?? error}`);
        }
};

export const removeLicenseFromDatabase = async (): Promise<void> => {
        await collection.rawCollection().deleteOne({ _id: DB_LICENSE_ID });
};

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

export const readLicenseFromDatabase = async (): Promise<LicenseStorageResult | null> => {
        const record = await collection.rawCollection().findOne({ _id: DB_LICENSE_ID });
        if (!record) {
                return null;
        }

        return {
                source: 'db',
                content: record.content,
        };
};

export const loadLicenseFromStorage = async (): Promise<LicenseStorageResult | null> => {
        const envResult = readLicenseFromEnv();
        if (envResult) {
                return envResult;
        }

        const fileResult = await readLicenseFromFile();
        if (fileResult) {
                return fileResult;
        }

        return readLicenseFromDatabase();
};
