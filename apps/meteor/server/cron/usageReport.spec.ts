import { Statistics } from '@rocket.chat/models';

import { sendUsageReportAndComputeRestriction } from './usageReport';

jest.mock('@rocket.chat/models', () => ({
        Statistics: {
                findLast: jest.fn(),
        },
}));

jest.mock('../lib/nicesoft-license', () => ({
        isLicensed: jest.fn(),
        getLimit: jest.fn(),
}));

jest.mock('../../app/statistics/server/functions/sendUsageReport', () => ({
	sendUsageReport: () => undefined,
}));

const logger = {
        debug: jest.fn(),
        warn: jest.fn(),
} as any;

const mockIsLicensed = jest.requireMock('../lib/nicesoft-license').isLicensed as jest.Mock;
const mockGetLimit = jest.requireMock('../lib/nicesoft-license').getLimit as jest.Mock;

describe('sendUsageReportAndComputeRestriction', () => {
        beforeEach(() => {
                jest.clearAllMocks();
                mockIsLicensed.mockReturnValue(true);
                mockGetLimit.mockReturnValue(7);
        });

        it('logs CE mode when license is missing', async () => {
                mockIsLicensed.mockReturnValue(false);

                await sendUsageReportAndComputeRestriction(undefined, logger);


                expect(logger.debug).toHaveBeenCalledWith('Usage report running in community edition mode');
                expect(Statistics.findLast).not.toHaveBeenCalled();
        });

	it('should use findLastStatsToken result when statsToken is omitted', async () => {
		const mockLastToken = 'last-token';
		(Statistics.findLastStatsToken as jest.Mock).mockResolvedValue(mockLastToken);

                await sendUsageReportAndComputeRestriction(undefined, logger);

                expect(Statistics.findLast).not.toHaveBeenCalled();
        });

        it('warns when grace period is exceeded', async () => {
                (Statistics.findLast as jest.Mock).mockResolvedValue({
                        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
                });

                await sendUsageReportAndComputeRestriction('token', logger);

                expect(logger.warn).toHaveBeenCalledWith(
                        'Usage report grace period exceeded',
                        expect.objectContaining({
                                daysSinceLastReport: expect.any(Number),
                                maxDaysWithoutReport: 7,
                                statsToken: 'token',
                        }),
                );
        });
});
