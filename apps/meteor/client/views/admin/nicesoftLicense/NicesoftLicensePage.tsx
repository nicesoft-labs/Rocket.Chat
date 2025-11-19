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

import { Page, PageHeader, PageScrollableContentWithShadow } from '../../../components/Page';
import PageSkeleton from '../../../components/PageSkeleton';
import type { OperationResult } from '@rocket.chat/rest-typings';
import { useFormatDateAndTime } from '../../../hooks/useFormatDateAndTime';

const statusToCalloutType = {
        valid: 'success',
        invalid: 'danger',
        missing: 'warning',
} as const;

type LicenseInfo = OperationResult<'GET', '/v1/nicesoft.license.info'>;

const NicesoftLicensePage = () => {
        const t = useTranslation();
        const dispatchToastMessage = useToastMessageDispatch();
        const queryClient = useQueryClient();
        const formatDateAndTime = useFormatDateAndTime();
        const stream = useStream('notify-all');

        const getLicenseInfo = useEndpoint<'GET', '/v1/nicesoft.license.info'>('GET', '/v1/nicesoft.license.info');
        const uploadLicense = useEndpoint<'POST', '/v1/nicesoft.license.upload'>('POST', '/v1/nicesoft.license.upload');
        const deleteLicense = useEndpoint<'DELETE', '/v1/nicesoft.license'>('DELETE', '/v1/nicesoft.license');

        const licenseQuery = useQuery<LicenseInfo>({
                queryKey: ['nicesoft-license-info'],
                queryFn: () => getLicenseInfo(),
        });

        const [licenseText, setLicenseText] = useState('');
        const [isUploading, setIsUploading] = useState(false);
        const [isDeleting, setIsDeleting] = useState(false);

        const status = licenseQuery.data?.status ?? 'missing';
        const source = licenseQuery.data?.source;

        const statusLabels = useMemo(() => {
                switch (status) {
                        case 'valid':
                                return {
                                        title: t('Nicesoft_License_Status_Licensed'),
                                        subtitle: t('Nicesoft_License_Status_Licensed_Description'),
                                };
                        case 'invalid':
                                return {
                                        title: t('Nicesoft_License_Status_Invalid'),
                                        subtitle: t('Nicesoft_License_Status_Invalid_Description'),
                                };
                        default:
                                return {
                                        title: t('Nicesoft_License_Status_Missing'),
                                        subtitle: t('Nicesoft_License_Status_Missing_Description'),
                                };
                }
        }, [status, t]);

        const sourceLabel = useMemo(() => {
                if (!source) {
                        return t('Nicesoft_License_Source_Unknown');
                }

                if (source === 'env') {
                        return t('Nicesoft_License_Source_Env');
                }

                return t('Nicesoft_License_Source_File');
        }, [source, t]);

        const expiresAt = licenseQuery.data?.expiresAt ?? null;
        const expiresDate = expiresAt ? new Date(expiresAt) : undefined;
        const isExpirationValid = Boolean(expiresDate && !Number.isNaN(expiresDate.getTime()));
        const daysRemaining = useMemo(() => {
                if (!isExpirationValid || !expiresDate) {
                        return null;
                }

                return Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        }, [expiresDate, isExpirationValid]);

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

                        if (!licenseText.trim()) {
                                dispatchToastMessage({ type: 'error', message: t('Nicesoft_License_Empty_Payload') });
                                return;
                        }

                        setIsUploading(true);
                        try {
                                await uploadLicense({ license: licenseText });
                                dispatchToastMessage({ type: 'success', message: t('Nicesoft_License_Upload_Success') });
                                setLicenseText('');
                                await queryClient.invalidateQueries({ queryKey: ['nicesoft-license-info'] });
                        } catch (error) {
                                if (error instanceof Error) {
                                        dispatchToastMessage({ type: 'error', message: error.message });
                                } else {
                                        dispatchToastMessage({ type: 'error', message: t('Nicesoft_License_Upload_Error') });
                                }
                        } finally {
                                setIsUploading(false);
                        }
                },
                [licenseText, dispatchToastMessage, t, uploadLicense, queryClient],
        );

        const handleDelete = useCallback(async () => {
                setIsDeleting(true);
                try {
                        await deleteLicense();
                        dispatchToastMessage({ type: 'success', message: t('Nicesoft_License_Delete_Success') });
                        await queryClient.invalidateQueries({ queryKey: ['nicesoft-license-info'] });
                } catch (error) {
                        if (error instanceof Error) {
                                dispatchToastMessage({ type: 'error', message: error.message });
                        } else {
                                dispatchToastMessage({ type: 'error', message: t('Nicesoft_License_Delete_Error') });
                        }
                } finally {
                        setIsDeleting(false);
                }
        }, [deleteLicense, dispatchToastMessage, queryClient, t]);

        const handleFileUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
                const file = event.currentTarget.files?.[0];
                if (!file) {
                        return;
                }

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

        const features = licenseQuery.data?.features ?? [];
        const limits = licenseQuery.data?.limits ? Object.entries(licenseQuery.data.limits) : [];
        const formattedExpiration = isExpirationValid && expiresDate ? formatDateAndTime(expiresDate) : undefined;
        const daysRemainingLabel = useMemo(() => {
                if (daysRemaining === null) {
                        return null;
                }

                if (daysRemaining <= 0) {
                        return t('Nicesoft_License_Expired');
                }

                return t('Nicesoft_License_Days_Left', { count: daysRemaining });
        }, [daysRemaining, t]);

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
                                                disabled={status === 'missing'}
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
                                                <Callout mb='x16' type={statusToCalloutType[status]} title={statusLabels.title}>
                                                        <Box>{statusLabels.subtitle}</Box>
                                                        {licenseQuery.data?.reason && (
                                                                <Box mt='x8'>
                                                                        <strong>{t('Nicesoft_License_Status_Reason')}:</strong> {licenseQuery.data.reason}
                                                                </Box>
                                                        )}
                                                </Callout>
                                                <FieldGroup>
                                                        <Field>
                                                                <FieldLabel>{t('Nicesoft_License_Edition')}</FieldLabel>
                                                                <FieldRow>{licenseQuery.data?.edition ?? t('Nicesoft_License_Not_Available')}</FieldRow>
                                                        </Field>
                                                        <Field>
                                                                <FieldLabel>{t('Nicesoft_License_Tenant')}</FieldLabel>
                                                                <FieldRow>{licenseQuery.data?.tenant ?? t('Nicesoft_License_Not_Available')}</FieldRow>
                                                        </Field>
                                                        <Field>
                                                                <FieldLabel>{t('Nicesoft_License_Valid_To')}</FieldLabel>
                                                                <FieldRow>{formattedExpiration ?? t('Nicesoft_License_Not_Available')}</FieldRow>
                                                                {daysRemainingLabel && <FieldHint>{daysRemainingLabel}</FieldHint>}
                                                        </Field>
                                                        <Field>
                                                                <FieldLabel>{t('Nicesoft_License_Source')}</FieldLabel>
                                                                <FieldRow>{sourceLabel}</FieldRow>
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
                                                                <Button primary type='submit' loading={isUploading} disabled={!licenseText.trim()}>
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
