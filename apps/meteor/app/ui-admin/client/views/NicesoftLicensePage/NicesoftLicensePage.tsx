import {
        Box,
        Button,
        ButtonGroup,
        Callout,
        Field,
        FieldGroup,
        FieldLabel,
        FieldRow,
        FieldHint,
        FileInput,
        TextAreaInput,
} from '@rocket.chat/fuselage';
import type { ChangeEvent, FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEndpoint, useStream, useToastMessageDispatch, useTranslation } from '@rocket.chat/ui-contexts';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Page, PageHeader, PageScrollableContentWithShadow } from '../../../../../client/components/Page';
import PageSkeleton from '../../../../../client/components/PageSkeleton';
import type { OperationResult } from '@rocket.chat/rest-typings';
import { useFormatDateAndTime } from '../../../../../client/hooks/useFormatDateAndTime';
import { useEndpointUploadMutation } from '../../../../../client/hooks/useEndpointUploadMutation';

type LicenseInfo = OperationResult<'GET', '/v1/nicesoft.license.info'>;

const getErrorMessage = (error: unknown): string | undefined => {
        if (error && typeof error === 'object' && 'error' in (error as Record<string, unknown>)) {
                return String((error as Record<string, unknown>).error);
        }

        if (error instanceof Error) {
                return error.message;
        }

        return undefined;
};

const NicesoftLicensePage = () => {
        const t = useTranslation();
        const dispatchToastMessage = useToastMessageDispatch();
        const queryClient = useQueryClient();
        const formatDateAndTime = useFormatDateAndTime();
        const stream = useStream('notify-all');

        const getLicenseInfo = useEndpoint<'GET', '/v1/nicesoft.license.info'>('GET', '/v1/nicesoft.license.info');
        const uploadLicenseJson = useEndpoint<'POST', '/v1/nicesoft.license.upload'>('POST', '/v1/nicesoft.license.upload');
        const { mutateAsync: uploadLicenseFile } = useEndpointUploadMutation('/v1/nicesoft.license.upload');
        const deleteLicense = useEndpoint<'DELETE', '/v1/nicesoft.license'>('DELETE', '/v1/nicesoft.license');

        const licenseQuery = useQuery<LicenseInfo>({
                queryKey: ['nicesoft-license-info'],
                queryFn: () => getLicenseInfo(),
        });

        const [licenseText, setLicenseText] = useState('');
        const [fileToUpload, setFileToUpload] = useState<File | null>(null);
        const [isUploading, setIsUploading] = useState(false);
        const [isDeleting, setIsDeleting] = useState(false);

        const status = licenseQuery.data?.status ?? 'missing';
        const source = licenseQuery.data?.source;
        const payload = licenseQuery.data?.payload;
        const reason = licenseQuery.data?.reason ?? null;

        const expiresInSeconds = licenseQuery.data?.expires_in ?? null;
        const validTo = payload?.valid_to ?? null;
        const validToDate = validTo ? new Date(validTo) : undefined;
        const isExpirationValid = Boolean(validToDate && !Number.isNaN(validToDate.getTime()));
        const daysRemaining = useMemo(() => {
                if (expiresInSeconds === null) {
                        return null;
                }

                return Math.ceil(expiresInSeconds / (60 * 60 * 24));
        }, [expiresInSeconds]);
        const isExpired = expiresInSeconds !== null && expiresInSeconds <= 0;
        const isExpiringSoon = expiresInSeconds !== null && expiresInSeconds > 0 && expiresInSeconds <= 60 * 60 * 24 * 7;

        const formattedExpiration = isExpirationValid && validToDate ? formatDateAndTime(validToDate) : undefined;

        const sourceLabel = useMemo(() => {
                if (!source) {
                        return t('Nicesoft_License_Source_Unknown');
                }

                if (source === 'env') {
                        return t('Nicesoft_License_Source_Env');
                }

                if (source === 'db') {
                        return t('Nicesoft_License_Source_DB');
                }

                return t('Nicesoft_License_Source_File');
        }, [source, t]);

        const resolveToastMessage = useCallback(
                (error: unknown, fallback: string) => {
                        const code = getErrorMessage(error);
                        if (code === 'invalid-license-schema') {
                                return t('Nicesoft_License_Error_Invalid_Schema');
                        }
                        if (code === 'invalid-license-signature') {
                                return t('Nicesoft_License_Error_Invalid_Signature');
                        }
                        if (code === 'invalid-license-dates') {
                                return t('Nicesoft_License_Error_Invalid_Dates');
                        }
                        if (code === 'unsupported-media-type') {
                                return t('Nicesoft_License_Error_Unsupported_Media');
                        }
                        if (code === 'license-env-readonly') {
                                return t('Nicesoft_License_Env_Delete_Not_Allowed');
                        }

                        return (error as Error)?.message || t(fallback);
                },
                [t],
        );

        useEffect(() => {
                if (licenseQuery.isError) {
                        dispatchToastMessage({ type: 'error', message: t('Nicesoft_License_Load_Failed') });
                }
        }, [licenseQuery.isError, dispatchToastMessage, t]);

        useEffect(() => {
                const unsubscribe = stream('licenseUpdated', async () => {
                        await queryClient.invalidateQueries({ queryKey: ['nicesoft-license-info'] });
                });

                return unsubscribe;
        }, [queryClient, stream]);

        const handleUpload = useCallback(
                async (event: FormEvent<HTMLFormElement>) => {
                        event.preventDefault();

                        if (!licenseText.trim() && !fileToUpload) {
                                dispatchToastMessage({ type: 'error', message: t('Nicesoft_License_Empty_Payload') });
                                return;
                        }

                        setIsUploading(true);
                        try {
                                if (fileToUpload) {
                                        const formData = new FormData();
                                        formData.append('file', fileToUpload);
                                        await uploadLicenseFile(formData);
                                } else {
                                        await uploadLicenseJson({ license: licenseText });
                                }

                                dispatchToastMessage({ type: 'success', message: t('Nicesoft_License_Upload_Success') });
                                setLicenseText('');
                                setFileToUpload(null);
                                await queryClient.invalidateQueries({ queryKey: ['nicesoft-license-info'] });
                        } catch (error) {
                                dispatchToastMessage({
                                        type: 'error',
                                        message: resolveToastMessage(error, 'Nicesoft_License_Upload_Error'),
                                });
                        } finally {
                                setIsUploading(false);
                        }
                },
                [licenseText, fileToUpload, dispatchToastMessage, t, uploadLicenseFile, uploadLicenseJson, queryClient, resolveToastMessage],
        );

        const handleDelete = useCallback(async () => {
                if (source === 'env') {
                        dispatchToastMessage({
                                type: 'error',
                                message: t('Nicesoft_License_Env_Delete_Not_Allowed'),
                        });
                        return;
                }

                setIsDeleting(true);
                try {
                        await deleteLicense();
                        dispatchToastMessage({ type: 'success', message: t('Nicesoft_License_Delete_Success') });
                        await queryClient.invalidateQueries({ queryKey: ['nicesoft-license-info'] });
                } catch (error) {
                        dispatchToastMessage({
                                type: 'error',
                                message: resolveToastMessage(error, 'Nicesoft_License_Delete_Error'),
                        });
                } finally {
                        setIsDeleting(false);
                }
        }, [deleteLicense, dispatchToastMessage, queryClient, resolveToastMessage, source, t]);

        const handleFileUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
                const file = event.currentTarget.files?.[0];
                if (!file) {
                        return;
                }

                setFileToUpload(file);

                const reader = new FileReader();
                reader.onload = (e) => {
                        if (typeof e.target?.result === 'string') {
                                setLicenseText(e.target.result);
                        }
                };
                reader.readAsText(file);
                event.currentTarget.value = '';
        }, []);

        if (licenseQuery.isPending) {
                return <PageSkeleton />;
        }

        if (licenseQuery.isError) {
                return (
                        <Page>
                                <PageHeader title={t('Nicesoft_License')}>
                                        <ButtonGroup>
                                                <Button icon='reload' onClick={() => licenseQuery.refetch()} loading={licenseQuery.isFetching}>
                                                        {t('Refresh')}
                                                </Button>
                                        </ButtonGroup>
                                </PageHeader>
                                <PageScrollableContentWithShadow>
                                        <Callout type='danger'>{t('Nicesoft_License_Load_Failed')}</Callout>
                                </PageScrollableContentWithShadow>
                        </Page>
                );
        }

        const features = payload?.features ?? [];
        const limits = payload?.limits ? Object.entries(payload.limits) : [];
        const daysRemainingLabel = useMemo(() => {
                if (daysRemaining === null) {
                        return null;
                }

                if (daysRemaining <= 0) {
                        return t('Nicesoft_License_Expired_Label');
                }

                return t('Nicesoft_License_Days_Left', { count: daysRemaining });
        }, [daysRemaining, t]);

        const renderStatus = () => {
                if (status === 'missing') {
                        return (
                                <Callout type='warning' title={t('Nicesoft_License_Status_Missing')} mb='x16'>
                                        <Box>{t('Nicesoft_License_Status_Missing_Description')}</Box>
                                </Callout>
                        );
                }

                if (status === 'invalid' || isExpired) {
                        return (
                                <Callout type='danger' title={t('Nicesoft_License_Status_Invalid')} mb='x16'>
                                        <Box>{isExpired ? t('Nicesoft_License_Status_Expired_Description') : t('Nicesoft_License_Status_Invalid_Description')}</Box>
                                        {reason && (
                                                <Box mt='x8'>
                                                        <strong>{t('Nicesoft_License_Status_Reason')}:</strong> {reason}
                                                </Box>
                                        )}
                                </Callout>
                        );
                }

                if (isExpiringSoon) {
                        return (
                                <Callout type='warning' title={t('Nicesoft_License_Status_Expiring_Soon')} mb='x16'>
                                        <Box>{t('Nicesoft_License_Status_Expiring_Soon_Description')}</Box>
                                </Callout>
                        );
                }

                return (
                        <Callout type='success' title={t('Nicesoft_License_Status_Licensed')} mb='x16'>
                                <Box>{t('Nicesoft_License_Status_Licensed_Description')}</Box>
                                {reason && (
                                        <Box mt='x8'>
                                                <strong>{t('Nicesoft_License_Status_Reason')}:</strong> {reason}
                                        </Box>
                                )}
                        </Callout>
                );
        };

        const isDeleteDisabled = status === 'missing';

        return (
                <Page>
                        <PageHeader title={t('Nicesoft_License')}>
                                <ButtonGroup>
                                        <Button icon='reload' onClick={() => licenseQuery.refetch()} loading={licenseQuery.isFetching}>
                                                {t('Refresh')}
                                        </Button>
                                        <Button
                                                danger
                                                icon='trash'
                                                disabled={isDeleteDisabled}
                                                loading={isDeleting}
                                                onClick={handleDelete}
                                        >
                                                {t('Nicesoft_License_Delete')}
                                        </Button>
                                </ButtonGroup>
                        </PageHeader>
                        <PageScrollableContentWithShadow>
                                <Box display='flex' flexDirection={{ default: 'column', md: 'row' }} gap='x16'>
                                        <Box flexGrow={1} minWidth={0}>
                                                {renderStatus()}
                                                <FieldGroup>
                                                        <Field>
                                                                <FieldLabel>{t('Nicesoft_License_Product')}</FieldLabel>
                                                                <FieldRow>{payload?.product ?? t('Nicesoft_License_Not_Available')}</FieldRow>
                                                        </Field>
                                                        <Field>
                                                                <FieldLabel>{t('Nicesoft_License_Edition')}</FieldLabel>
                                                                <FieldRow>{payload?.edition ?? t('Nicesoft_License_Not_Available')}</FieldRow>
                                                        </Field>
                                                        <Field>
                                                                <FieldLabel>{t('Nicesoft_License_Tenant')}</FieldLabel>
                                                                <FieldRow>{payload?.tenant ?? t('Nicesoft_License_Not_Available')}</FieldRow>
                                                        </Field>
                                                        <Field>
                                                                <FieldLabel>{t('Nicesoft_License_Valid_From')}</FieldLabel>
                                                                <FieldRow>{payload?.valid_from ? formatDateAndTime(new Date(payload.valid_from)) : t('Nicesoft_License_Not_Available')}</FieldRow>
                                                        </Field>
                                                        <Field>
                                                                <FieldLabel>{t('Nicesoft_License_Valid_To')}</FieldLabel>
                                                                <FieldRow>{formattedExpiration ?? t('Nicesoft_License_Not_Available')}</FieldRow>
                                                                {daysRemainingLabel && <FieldHint>{daysRemainingLabel}</FieldHint>}
                                                        </Field>
                                                        <Field>
                                                                <FieldLabel>{t('Nicesoft_License_Source')}</FieldLabel>
                                                                <FieldRow>{sourceLabel}</FieldRow>
                                                                {source === 'env' && (
                                                                        <FieldHint>{t('Nicesoft_License_Env_Not_Removable')}</FieldHint>
                                                                )}
                                                        </Field>
                                                </FieldGroup>
                                                <Box mt='x16'>
                                                        <FieldLabel>{t('Nicesoft_License_Features')}</FieldLabel>
                                                        {features.length > 0 ? (
                                                                <Box is='ul' pl='x20' color='default'>
                                                                        {features.map((feature) => (
                                                                                <Box is='li' key={feature}>
                                                                                        {feature}
                                                                                </Box>
                                                                        ))}
                                                                </Box>
                                                        ) : (
                                                                <Box color='hint'>{t('Nicesoft_License_No_Features')}</Box>
                                                        )}
                                                </Box>
                                                <Box mt='x16'>
                                                        <FieldLabel>{t('Nicesoft_License_Limits')}</FieldLabel>
                                                        {limits.length > 0 ? (
                                                                <Box is='ul' pl='x20' color='default'>
                                                                        {limits.map(([key, value]) => (
                                                                                <Box is='li' key={key}>
                                                                                        {key}: {value}
                                                                                </Box>
                                                                        ))}
                                                                </Box>
                                                        ) : (
                                                                <Box color='hint'>{t('Nicesoft_License_No_Limits')}</Box>
                                                        )}
                                                </Box>
                                        </Box>
                                        <Box flexGrow={1} minWidth={0}>
                                                <Box is='form' onSubmit={handleUpload} display='flex' flexDirection='column' gap='x16'>
                                                        <FieldGroup>
                                                                <Field>
                                                                        <FieldLabel>{t('Nicesoft_License_Paste_Label')}</FieldLabel>
                                                                        <FieldRow>
                                                                                <TextAreaInput
                                                                                        rows={8}
                                                                                        placeholder={t('Nicesoft_License_Paste_Placeholder')}
                                                                                        value={licenseText}
                                                                                        onChange={(event) => setLicenseText(event.currentTarget.value)}
                                                                                />
                                                                        </FieldRow>
                                                                </Field>
                                                                <Field>
                                                                        <FieldLabel>{t('Nicesoft_License_File_Label')}</FieldLabel>
                                                                        <FieldRow>
                                                                                <FileInput accept='.json,.txt,application/json,text/plain' onChange={handleFileUpload} />
                                                                        </FieldRow>
                                                                        <FieldHint>{t('Nicesoft_License_File_Hint')}</FieldHint>
                                                                </Field>
                                                        </FieldGroup>
                                                        <ButtonGroup align='end'>
                                                                <Button primary type='submit' loading={isUploading} disabled={!licenseText.trim() && !fileToUpload}>
                                                                        {t('Nicesoft_License_Submit')}
                                                                </Button>
                                                        </ButtonGroup>
                                                </Box>
                                        </Box>
                                </Box>
                        </PageScrollableContentWithShadow>
                </Page>
        );
};

export default NicesoftLicensePage;
