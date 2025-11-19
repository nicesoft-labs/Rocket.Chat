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
jest.mock('../../../../../client/hooks/useEndpointUploadMutation', () => ({
        useEndpointUploadMutation: jest.fn(),
}));

const mockUseEndpoint = jest.requireMock('@rocket.chat/ui-contexts').useEndpoint as jest.Mock;
const mockUseStream = jest.requireMock('@rocket.chat/ui-contexts').useStream as jest.Mock;
const mockToast = jest.requireMock('@rocket.chat/ui-contexts').useToastMessageDispatch as jest.Mock;
const mockUploadMutation = jest.requireMock('../../../../../client/hooks/useEndpointUploadMutation')
        .useEndpointUploadMutation as jest.Mock;

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
        const uploadFileMock = jest.fn().mockResolvedValue(data);

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

        mockUploadMutation.mockReturnValue({ mutateAsync: uploadFileMock });

        return { getMock, uploadMock, deleteMock, uploadFileMock };
};

describe('NicesoftLicensePage', () => {
        const basePayload: OperationResult<'GET', '/v1/nicesoft.license.info'>['payload'] = {
                product: 'rocket',
                edition: 'pro',
                tenant: 'acme',
                valid_from: '2024-01-01T00:00:00.000Z',
                valid_to: '2999-01-01T00:00:00.000Z',
                features: ['feat'],
                limits: { users: 10 },
        };

        beforeAll(() => {
                class MockFileReader {
                        public result: string | ArrayBuffer | null = null;
                        public onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

                        readAsText(file: Blob) {
                                this.result = file instanceof Blob ? 'file-content' : null;
                                this.onload?.({ target: { result: this.result } } as ProgressEvent<FileReader>);
                        }
                }

                (global as any).FileReader = MockFileReader;
        });

        beforeEach(() => {
                jest.clearAllMocks();
                mockToast.mockReturnValue(jest.fn());
        });

        it('shows missing state', async () => {
                setupEndpoints({
                        status: 'missing',
                        source: null,
                        reason: null,
                        expires_in: null,
                        payload: {
                                product: null,
                                edition: null,
                                tenant: null,
                                valid_from: null,
                                valid_to: null,
                                features: [],
                                limits: {},
                        },
                });

                renderWithClient(<NicesoftLicensePage />);

                expect(await screen.findByText('Nicesoft_License_Status_Missing')).toBeInTheDocument();
        });

        it('renders invalid reason', async () => {
                setupEndpoints({
                        status: 'invalid',
                        source: 'file',
                        reason: 'bad-signature',
                        expires_in: null,
                        payload: { ...basePayload, edition: null, product: null, tenant: null, valid_from: null, valid_to: null, features: [], limits: {} },
                });

                renderWithClient(<NicesoftLicensePage />);

                expect(await screen.findByText(/bad-signature/)).toBeInTheDocument();
        });

        it('renders valid license details', async () => {
                setupEndpoints({
                        status: 'valid',
                        source: 'file',
                        reason: null,
                        expires_in: 123,
                        payload: basePayload,
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
                        expires_in: null,
                        payload: { ...basePayload, product: null, edition: null, tenant: null, valid_from: null, valid_to: null, features: [], limits: {} },
                });

                renderWithClient(<NicesoftLicensePage />);

                const textarea = await screen.findByPlaceholderText('Nicesoft_License_Paste_Placeholder');
                fireEvent.change(textarea, { target: { value: '{"license":true}' } });
                fireEvent.click(screen.getByText('Nicesoft_License_Submit'));

                await waitFor(() => expect(uploadMock).toHaveBeenCalled());
                const toast = mockToast.mock.results[0].value as jest.Mock;
                expect(toast).toHaveBeenCalledWith({
                        type: 'success',
                        message: 'Nicesoft_License_Upload_Success',
                });
        });

        it('deletes license', async () => {
                const { deleteMock } = setupEndpoints({
                        status: 'valid',
                        source: 'file',
                        reason: null,
                        expires_in: null,
                        payload: { ...basePayload, features: [], limits: {} },
                });

                renderWithClient(<NicesoftLicensePage />);

                fireEvent.click(await screen.findByText('Nicesoft_License_Delete'));
                await waitFor(() => expect(deleteMock).toHaveBeenCalled());

                const toast = mockToast.mock.results[0].value as jest.Mock;
                expect(toast).toHaveBeenCalledWith({
                        type: 'success',
                        message: 'Nicesoft_License_Delete_Success',
                });
        });

        it('shows schema error toast on upload failure', async () => {
                const { uploadMock } = setupEndpoints({
                        status: 'missing',
                        source: null,
                        reason: null,
                        expires_in: null,
                        payload: { ...basePayload, product: null, edition: null, valid_from: null, valid_to: null, features: [], limits: {} },
                });

                uploadMock.mockRejectedValue(new Error('invalid-license-schema'));

                renderWithClient(<NicesoftLicensePage />);
                const textarea = await screen.findByPlaceholderText('Nicesoft_License_Paste_Placeholder');
                fireEvent.change(textarea, { target: { value: '{"license":true}' } });
                fireEvent.click(screen.getByText('Nicesoft_License_Submit'));

                await waitFor(() => expect(uploadMock).toHaveBeenCalled());
                const toast = mockToast.mock.results[0].value as jest.Mock;
                expect(toast).toHaveBeenCalledWith({
                        type: 'error',
                        message: 'Nicesoft_License_Error_Invalid_Schema',
                });
        });

        it('shows signature error toast on upload failure', async () => {
                const { uploadMock } = setupEndpoints({
                        status: 'missing',
                        source: null,
                        reason: null,
                        expires_in: null,
                        payload: { ...basePayload, product: null, edition: null, valid_from: null, valid_to: null, features: [], limits: {} },
                });

                uploadMock.mockRejectedValue(new Error('invalid-license-signature'));

                renderWithClient(<NicesoftLicensePage />);
                const textarea = await screen.findByPlaceholderText('Nicesoft_License_Paste_Placeholder');
                fireEvent.change(textarea, { target: { value: '{"license":true}' } });
                fireEvent.click(screen.getByText('Nicesoft_License_Submit'));

                await waitFor(() => expect(uploadMock).toHaveBeenCalled());
                const toast = mockToast.mock.results[0].value as jest.Mock;
                expect(toast).toHaveBeenCalledWith({
                        type: 'error',
                        message: 'Nicesoft_License_Error_Invalid_Signature',
                });
        });

        it('shows error toast when fetch fails', async () => {
                const { getMock } = setupEndpoints({
                        status: 'missing',
                        source: null,
                        reason: null,
                        expires_in: null,
                        payload: { ...basePayload, product: null, edition: null, valid_from: null, valid_to: null, features: [], limits: {} },
                });

                getMock.mockRejectedValue(new Error('boom'));

                renderWithClient(<NicesoftLicensePage />);

                const toast = mockToast.mock.results[0].value as jest.Mock;
                await waitFor(() => expect(toast).toHaveBeenCalledWith({ type: 'error', message: 'Nicesoft_License_Load_Failed' }));
        });

        it('listens to licenseUpdated stream and refetches', async () => {
                const getMock = jest.fn()
                        .mockResolvedValueOnce({
                                status: 'missing',
                                source: null,
                                reason: null,
                                expires_in: null,
                                payload: { ...basePayload, product: null, edition: null, valid_to: null, valid_from: null, features: [], limits: {} },
                        })
                        .mockResolvedValueOnce({
                                status: 'valid',
                                source: 'file',
                                reason: null,
                                expires_in: 100,
                                payload: basePayload,
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
