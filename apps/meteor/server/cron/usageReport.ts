import { cronJobs } from '@rocket.chat/cron';
import type { Logger } from '@rocket.chat/logger';
import { Statistics } from '@rocket.chat/models';

import { sendUsageReport } from '../../app/statistics/server/functions/sendUsageReport';
import { getLimit, isLicensed } from '../lib/nicesoft-license';


const DAY_IN_MS = 24 * 60 * 60 * 1000;
const USAGE_REPORT_LIMIT_KEY = 'usage-report.maxDaysWithoutReport';

export const sendUsageReportAndComputeRestriction = async (statsToken?: string, logger?: Logger) => {
        if (!isLicensed()) {
            logger?.debug?.('Usage report running in community edition mode');
            return;
        }

        const maxDaysWithoutReport = getLimit(USAGE_REPORT_LIMIT_KEY);
        if (maxDaysWithoutReport == null) {
            return;
        }

        const lastStats = await Statistics.findLast();
        if (!lastStats?.createdAt) {
            logger?.debug?.('Usage report limit configured but no statistics document was found');
            return;
        }

        const daysSinceLastReport = Math.floor((Date.now() - lastStats.createdAt.getTime()) / DAY_IN_MS);

        if (daysSinceLastReport > maxDaysWithoutReport) {
            logger?.warn?.('Usage report grace period exceeded', {
                daysSinceLastReport,
                maxDaysWithoutReport,
                statsToken,
            });
            return;
        }

        logger?.debug?.('Usage report grace period within limits', {
            daysSinceLastReport,
            maxDaysWithoutReport,
            statsToken,
        });
};

export async function usageReportCron(logger: Logger): Promise<void> {
        const name = 'Generate and save statistics';

        const statsToken = await sendUsageReport(logger);
        await sendUsageReportAndComputeRestriction(statsToken, logger);

	const now = new Date();

	return cronJobs.add(name, `12 ${now.getHours()} * * *`, async () => {
                const statsToken = await sendUsageReport(logger);
                await sendUsageReportAndComputeRestriction(statsToken, logger);
        });
}
