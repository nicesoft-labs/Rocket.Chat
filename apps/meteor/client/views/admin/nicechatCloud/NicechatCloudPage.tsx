import type { CloudConnectionStatus } from '@rocket.chat/nicesoft-cloud';
import { Box, Button, ButtonGroup, Callout, Field, Tag, TextInput } from '@rocket.chat/fuselage';
import { useToastMessageDispatch, useEndpoint } from '@rocket.chat/ui-contexts';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Page, PageHeader, PageScrollableContentWithShadow } from '../../../components/Page';

type NicechatStatusResponse = { status: CloudConnectionStatus };

type NicechatCheckResponse = { connected: boolean };

const NicechatCloudPage = () => {
const { t } = useTranslation();
const dispatchToastMessage = useToastMessageDispatch();

const getStatus = useEndpoint<NicechatStatusResponse>('GET', '/v1/nicechat-cloud.status');
const connect = useEndpoint<NicechatStatusResponse>('POST', '/v1/nicechat-cloud.connect');
const disconnect = useEndpoint<NicechatStatusResponse>('POST', '/v1/nicechat-cloud.disconnect');
const checkConnection = useEndpoint<NicechatCheckResponse>('GET', '/v1/nicechat-cloud.checkConnection');

const [workspaceId, setWorkspaceId] = useState('');

const { data, refetch, isFetching } = useQuery<NicechatStatusResponse>({
queryKey: ['nicechat-cloud', 'status'],
queryFn: async () => getStatus(),
});

const status = useMemo<CloudConnectionStatus | undefined>(() => data?.status, [data]);

useEffect(() => {
if (status?.workspaceId) {
setWorkspaceId(status.workspaceId);
}
}, [status?.workspaceId]);

const handleConnect = useMutation<NicechatStatusResponse>({
mutationFn: async () => {
if (!workspaceId.trim()) {
throw new Error('invalid-workspace-id');
}

return connect({ workspaceId: workspaceId.trim() });
},
onSuccess: (response) => {
void refetch();
setWorkspaceId(response.status.workspaceId ?? '');
dispatchToastMessage({ type: 'success', message: t('NiceChatCloud_Connected') });
},
onError: () => dispatchToastMessage({ type: 'error', message: t('NiceChatCloud_InvalidWorkspaceId') }),
});

const handleDisconnect = useMutation<NicechatStatusResponse>({
mutationFn: async () => disconnect(),
onSuccess: (response) => {
void refetch();
setWorkspaceId(response.status.workspaceId ?? '');
dispatchToastMessage({ type: 'info', message: t('NiceChatCloud_Disconnected') });
},
onError: () => dispatchToastMessage({ type: 'error', message: t('NiceChatCloud_ActionFailed') }),
});

const handleCheckConnection = useMutation<NicechatCheckResponse>({
mutationFn: async () => checkConnection(),
onSuccess: ({ connected }) =>
dispatchToastMessage({
type: connected ? 'success' : 'warning',
message: connected ? t('NiceChatCloud_Check_Passed') : t('NiceChatCloud_Check_Failed'),
}),
onError: () => dispatchToastMessage({ type: 'error', message: t('NiceChatCloud_ActionFailed') }),
});

const isBusy = isFetching || handleConnect.isLoading || handleDisconnect.isLoading || handleCheckConnection.isLoading;

return (
<Page bg='tint'>
<PageHeader title={t('NiceChatCloud_Title')} />
<PageScrollableContentWithShadow p={16}>
<Box display='flex' flexDirection='column' gap={16}>
<Callout type='info'>{t('NiceChatCloud_Description')}</Callout>
<Box display='flex' alignItems='center' gap={8}>
<Tag variation={status?.connected ? 'success' : 'secondary'}>
{status?.connected ? t('NiceChatCloud_Status_Connected') : t('NiceChatCloud_Status_Disconnected')}
</Tag>
<Box fontScale='p2' color='hint'>
{status?.workspaceId ? t('NiceChatCloud_WorkspaceId_Label', { id: status.workspaceId }) : t('NiceChatCloud_WorkspaceId_Missing')}
</Box>
</Box>
<Field>
<Field.Label>{t('NiceChatCloud_WorkspaceId')}</Field.Label>
<Field.Row>
<TextInput value={workspaceId} onChange={(event) => setWorkspaceId(event.currentTarget.value)} disabled={isBusy} placeholder={t('NiceChatCloud_WorkspaceId_Placeholder')} />
</Field.Row>
</Field>
<ButtonGroup align='end'>
<Button primary onClick={() => handleConnect.mutate()} disabled={isBusy}>
{t('NiceChatCloud_Connect')}
</Button>
<Button onClick={() => handleDisconnect.mutate()} disabled={isBusy || !status?.connected}>
{t('NiceChatCloud_Disconnect')}
</Button>
<Button onClick={() => handleCheckConnection.mutate()} disabled={isBusy}>
{t('NiceChatCloud_CheckConnection')}
</Button>
</ButtonGroup>
</Box>
</PageScrollableContentWithShadow>
</Page>
);
};

export default NicechatCloudPage;
