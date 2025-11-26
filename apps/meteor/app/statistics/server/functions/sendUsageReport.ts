import type { IStats } from '@rocket.chat/core-typings';
import type { Logger } from '@rocket.chat/logger';
import { Statistics } from '@rocket.chat/models';
import { serverFetch as fetch } from '@rocket.chat/server-fetch';
import { tracerSpan } from '@rocket.chat/tracing';
import { Meteor } from 'meteor/meteor';

import { statistics } from '..';
import { settings } from '../../../settings/server';
import { getWorkspaceAccessToken } from '../../../cloud/server';

const preparePayload = (cronStatistics: IStats, anonymize: boolean): Record<string, any> => {
        const payload: Record<string, any> = { ...cronStatistics };

        if (anonymize) {
                delete payload.uniqueId;
                delete payload.deploymentFingerprintHash;
                delete payload.deploymentFingerprintVerified;
                delete payload.lastLogin;
                delete payload.lastMessageSentAt;
                delete payload.lastSeenSubscription;
                delete payload.siteUrl;
                delete payload.instanceName;
                delete payload.host;
        }

        return payload;
};

async function sendStats(logger: Logger, cronStatistics: IStats): Promise<string | undefined> {
        if (!settings.get('Telemetry_NiceCloud_Enabled')) {
                return;
        }

        const anonymizeTelemetry = settings.get('Telemetry_NiceCloud_Anonymize');
        const telemetryEndpoint = settings.get('Telemetry_NiceCloud_Endpoint') || 'https://collector.nice.chat/';

        try {
                const token = await getWorkspaceAccessToken();
                const headers = { ...(token && { Authorization: `Bearer ${token}` }) };

                const payload = preparePayload(cronStatistics, anonymizeTelemetry);
                if (!anonymizeTelemetry) {
                        payload.host = Meteor.absoluteUrl();
                }

                const response = await fetch(telemetryEndpoint, {
                        method: 'POST',
                        body: payload,
                        headers,
                });

		const { statsToken } = await response.json();

		if (statsToken != null) {
			await Statistics.updateOne({ _id: cronStatistics._id }, { $set: { statsToken } });
			return statsToken;
		}
	} catch (err) {
		logger.error({ msg: 'Failed to send usage report', err });
	}
}

export async function sendUsageReport(logger: Logger): Promise<string | undefined> {
	return tracerSpan('generateStatistics', {}, async () => {
		const last = await Statistics.findLast();
		if (last) {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);

			// if the last data we have has less than 24h and was not sent to yet, send it
			if (last.createdAt > yesterday) {
				// but if it has the confirmation token, we can skip
				if (last.statsToken) {
					return last.statsToken;
				}

				// if it doesn't it means the request failed, so we try sending again with the same data
				return sendStats(logger, last);
			}
		}

		// if our latest stats has more than 24h, it is time to generate a new one and send it
		const cronStatistics = await statistics.save();

		return sendStats(logger, cronStatistics);
	});
}
