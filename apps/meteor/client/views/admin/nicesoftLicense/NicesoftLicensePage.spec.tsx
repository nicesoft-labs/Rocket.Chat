import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { OperationResult } from '@rocket.chat/rest-typings';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import NicesoftLicensePage from './NicesoftLicensePage';

jest.mock('@rocket.chat/ui-contexts', () => ({
        useTranslation: () => (key: string, params?: Record<string, any>) => {
                if (params?.count) {
                        return `${key}:${params.count}`;
                }

                return key;
        },
        useToastMessageDispatch: () => jest.fn(),
        useEndpoint: jest.fn(),
        useFormatDateAndTime: () => (date: Date) => date.toISOString(),
        useStream: jest.fn(() => jest.fn(() => () => undefined)),
}));

const mockUseEndpoint = jest.requireMock('@rocket.chat/ui-contexts').useEndpoint as jest.Mock;
const mockUseStream = jest.requireMock('@rocket.chat/ui-contexts').useStream as jest.Mock;
const mockToast = jest.requireMock('@rocket.chat/ui-contexts').useToastMessageDispatch as jest.Mock;

const renderWithClient = (ui: JSX.Element) => {
        const queryClient = new QueryClient({
                defaultOptions: { queries: { retry: false } },
        });

        return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

const setupEndpoints = (data: OperationResult<'GET', '/v1/nicesoft.license.info'>) => {
        const getMock = jest.fn().mockResolvedValue(data);
        const uploadMock = jest.fn().mockResolvedValue(data);
        const deleteMock = jest.fn().mockResolvedValue(data);

        mockUseEndpoint.mockImplementation((method: string) => {
                if (method === 'GET') {
                        return getMock;
                }
                if (method === 'POST') {
                        return uploadMock;
                }
                if (method === 'DELETE') {
                        return deleteMock;
                }

                return jest.fn();
        });

        return { getMock, uploadMock, deleteMock };
};

describe('NicesoftLicensePage', () => {
        beforeEach(() => {
                jest.clearAllMocks();
        });

        it('shows missing state', async () => {
                setupEndpoints({
                        status: 'missing',
                        source: null,
                        reason: null,
                        expiresAt: null,
                        expiresInSeconds: null,
                        edition: null,
                        tenant: null,
                        features: [],
                        limits: {},
                });

                renderWithClient(<NicesoftLicensePage />);

                expect(await screen.findByText('Nicesoft_License_Status_Missing')).toBeInTheDocument();
        });

        it('renders invalid reason', async () => {
                setupEndpoints({
                        status: 'invalid',
                        source: 'file',
                        reason: 'bad-signature',
                        expiresAt: null,
                        expiresInSeconds: null,
                        edition: null,
                        tenant: null,
                        features: [],
                        limits: {},
                });

                renderWithClient(<NicesoftLicensePage />);

                expect(await screen.findByText(/bad-signature/)).toBeInTheDocument();
        });

        it('renders valid license details', async () => {
                setupEndpoints({
                        status: 'valid',
                        source: 'file',
                        reason: null,
                        expiresAt: '2999-01-01T00:00:00.000Z',
                        expiresInSeconds: 123,
                        edition: 'pro',
                        tenant: 'acme',
                        features: ['feat'],
                        limits: { users: 10 },
                });

                renderWithClient(<NicesoftLicensePage />);

                expect(await screen.findByText('pro')).toBeInTheDocument();
                expect(screen.getByText('feat')).toBeInTheDocument();
                expect(screen.getByText(/users: 10/)).toBeInTheDocument();
        });

        it('uploads license and shows toast', async () => {
                const { uploadMock } = setupEndpoints({
                        status: 'missing',
                        source: null,
                        reason: null,
                        expiresAt: null,
                        expiresInSeconds: null,
                        edition: null,
                        tenant: null,
                        features: [],
                        limits: {},
                });

                renderWithClient(<NicesoftLicensePage />);

                const textarea = await screen.findByPlaceholderText('Nicesoft_License_Paste_Placeholder');
                fireEvent.change(textarea, { target: { value: '{"license":true}' } });
                fireEvent.click(screen.getByText('Nicesoft_License_Submit'));

                await waitFor(() => expect(uploadMock).toHaveBeenCalled());
                expect(mockToast()).toBeInstanceOf(Function);
        });

        it('deletes license', async () => {
                const { deleteMock } = setupEndpoints({
                        status: 'valid',
                        source: 'file',
                        reason: null,
                        expiresAt: null,
                        expiresInSeconds: null,
                        edition: 'pro',
                        tenant: 'acme',
                        features: [],
                        limits: {},
                });

                renderWithClient(<NicesoftLicensePage />);

                fireEvent.click(await screen.findByText('Nicesoft_License_Delete'));
                await waitFor(() => expect(deleteMock).toHaveBeenCalled());
        });

        it('listens to licenseUpdated stream and refetches', async () => {
                const getMock = jest.fn()
                        .mockResolvedValueOnce({
                                status: 'missing',
                                source: null,
                                reason: null,
                                expiresAt: null,
                                expiresInSeconds: null,
                                edition: null,
                                tenant: null,
                                features: [],
                                limits: {},
                        })
                        .mockResolvedValueOnce({
                                status: 'valid',
                                source: 'file',
                                reason: null,
                                expiresAt: '2999-01-01T00:00:00.000Z',
                                expiresInSeconds: 100,
                                edition: 'pro',
                                tenant: 'acme',
                                features: ['feat'],
                                limits: {},
                        });

                const uploadMock = jest.fn();
                const deleteMock = jest.fn();
                mockUseEndpoint.mockImplementation((method: string) => {
                        if (method === 'GET') {
                                return getMock;
                        }
                        if (method === 'POST') {
                                return uploadMock;
                        }
                        if (method === 'DELETE') {
                                return deleteMock;
                        }
                        return jest.fn();
                });

                let streamCallback: (() => void) | undefined;
                mockUseStream.mockReturnValue((event: string, cb: () => void) => {
                        if (event === 'licenseUpdated') {
                                streamCallback = cb;
                        }
                        return () => undefined;
                });

                renderWithClient(<NicesoftLicensePage />);
                expect(await screen.findByText('Nicesoft_License_Status_Missing')).toBeInTheDocument();

                await act(async () => {
                        streamCallback?.();
                });

                await waitFor(() => expect(getMock).toHaveBeenCalledTimes(2));
                expect(await screen.findByText('pro')).toBeInTheDocument();
        });
});
