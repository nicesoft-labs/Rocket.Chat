import { registerLimitCounter, shouldPreventAction } from './limitCounters';
import { getLimit, isLicensed } from './helpers';

jest.mock('./helpers', () => ({
        __esModule: true,
        getLimit: jest.fn(),
        isLicensed: jest.fn(),
}));

const LIMIT_KEY = 'monthlyActiveContacts';

describe('nicesoft license limit counters', () => {
        const isLicensedMock = isLicensed as jest.MockedFunction<typeof isLicensed>;
        const getLimitMock = getLimit as jest.MockedFunction<typeof getLimit>;
        const counterMock = jest.fn(async () => 0);

        beforeAll(() => {
                registerLimitCounter(LIMIT_KEY, counterMock);
        });

        beforeEach(() => {
                        jest.clearAllMocks();
                        isLicensedMock.mockReturnValue(true);
                        getLimitMock.mockReturnValue(100);
                        counterMock.mockResolvedValue(0);
        });

        it('does not block omnichannel when there is no license', async () => {
                isLicensedMock.mockReturnValue(false);

                await expect(shouldPreventAction(LIMIT_KEY)).resolves.toBe(false);
                expect(counterMock).not.toHaveBeenCalled();
        });

        it('allows accepting new contacts when usage is below the limit', async () => {
                counterMock.mockResolvedValue(99);

                await expect(shouldPreventAction(LIMIT_KEY, 1)).resolves.toBe(false);
        });

        it('blocks new contacts when the limit has been reached', async () => {
                counterMock.mockResolvedValue(100);

                await expect(shouldPreventAction(LIMIT_KEY, 1)).resolves.toBe(true);
        });
});
