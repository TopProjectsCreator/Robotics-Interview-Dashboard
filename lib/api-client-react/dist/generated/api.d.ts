import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AdvanceQueueInput, Applicant, ApplicantList, ApplicantUpdate, AssistantConfig, AssistantConversation, AssistantConversationInput, AssistantConversationList, AssistantConversationUpdate, AssistantHistory, AssistantInput, AssistantResponse, AuthSession, Broadcast, BroadcastAck, BroadcastInput, BroadcastList, DashboardChart, DashboardChartInput, DashboardChartList, DashboardChartUpdate, DashboardSummary, DisplaySettings, DisplaySettingsInput, DisplayState, ErrorResponse, GenerateImageInput, GenerateImageResult, GetAssistantConversationMessagesParams, GetInterviewChatParams, GetPresenceStatsParams, HealthStatus, ImportHistory, ImportInput, ImportPreview, ImportResult, InterviewChat, InterviewChatInput, InterviewChatMessage, ListApplicantsParams, LoginInput, MessageResponse, PresenceHeartbeat, PresenceHeartbeatInput, PresenceIpStats, PresenceKickInput, PresenceKickResult, PresenceList, QueueCallbackInput, QueueSettingsInput, QueueState, ReorderQueueInput, SeatingAssignInput, SeatingSettings, SeatingSettingsInput, Snapshot, SnapshotInput, SnapshotList, SnapshotRestoreInput, SnapshotRestoreResult, SystemUsage, UploadInput, UploadResponse } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetSystemUsageUrl: () => string;
/**
 * @summary Supabase usage measured from the database vs plan quotas
 */
export declare const getSystemUsage: (options?: Parameters<typeof customFetch>[1]) => Promise<SystemUsage>;
export declare const getGetSystemUsageQueryKey: () => readonly ["/api/system/usage"];
export declare const getGetSystemUsageQueryOptions: <TData = Awaited<ReturnType<typeof getSystemUsage>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSystemUsage>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getSystemUsage>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetSystemUsageQueryResult = NonNullable<Awaited<ReturnType<typeof getSystemUsage>>>;
export type GetSystemUsageQueryError = ErrorType<unknown>;
/**
 * @summary Supabase usage measured from the database vs plan quotas
 */
export declare function useGetSystemUsage<TData = Awaited<ReturnType<typeof getSystemUsage>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSystemUsage>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getLoginUrl: () => string;
/**
 * @summary Start an admin session
 */
export declare const login: (loginInput: LoginInput, options?: Parameters<typeof customFetch>[1]) => Promise<AuthSession>;
export declare const getLoginMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginInput>;
}, TContext>;
export type LoginMutationResult = NonNullable<Awaited<ReturnType<typeof login>>>;
export type LoginMutationBody = BodyType<LoginInput>;
export type LoginMutationError = ErrorType<ErrorResponse>;
/**
* @summary Start an admin session
*/
export declare const useLogin: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginInput>;
}, TContext>;
export declare const getGetSessionUrl: () => string;
/**
 * @summary Get the current admin session
 */
export declare const getSession: (options?: Parameters<typeof customFetch>[1]) => Promise<AuthSession>;
export declare const getGetSessionQueryKey: () => readonly ["/api/auth/session"];
export declare const getGetSessionQueryOptions: <TData = Awaited<ReturnType<typeof getSession>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSession>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getSession>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetSessionQueryResult = NonNullable<Awaited<ReturnType<typeof getSession>>>;
export type GetSessionQueryError = ErrorType<unknown>;
/**
 * @summary Get the current admin session
 */
export declare function useGetSession<TData = Awaited<ReturnType<typeof getSession>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSession>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getLogoutUrl: () => string;
/**
 * @summary End the current admin session
 */
export declare const logout: (options?: Parameters<typeof customFetch>[1]) => Promise<MessageResponse>;
export declare const getLogoutMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
export type LogoutMutationResult = NonNullable<Awaited<ReturnType<typeof logout>>>;
export type LogoutMutationError = ErrorType<unknown>;
/**
* @summary End the current admin session
*/
export declare const useLogout: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
export declare const getGetDashboardSummaryUrl: () => string;
/**
 * @summary Get dashboard totals and grouped insights
 */
export declare const getDashboardSummary: (options?: Parameters<typeof customFetch>[1]) => Promise<DashboardSummary>;
export declare const getGetDashboardSummaryQueryKey: () => readonly ["/api/dashboard/summary"];
export declare const getGetDashboardSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getDashboardSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDashboardSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboardSummary>>>;
export type GetDashboardSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Get dashboard totals and grouped insights
 */
export declare function useGetDashboardSummary<TData = Awaited<ReturnType<typeof getDashboardSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getPostPresenceHeartbeatUrl: () => string;
/**
 * @summary Record coordinator presence heartbeat
 */
export declare const postPresenceHeartbeat: (presenceHeartbeatInput?: PresenceHeartbeatInput, options?: Parameters<typeof customFetch>[1]) => Promise<PresenceHeartbeat>;
export declare const getPostPresenceHeartbeatMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof postPresenceHeartbeat>>, TError, {
        data?: BodyType<PresenceHeartbeatInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof postPresenceHeartbeat>>, TError, {
    data?: BodyType<PresenceHeartbeatInput>;
}, TContext>;
export type PostPresenceHeartbeatMutationResult = NonNullable<Awaited<ReturnType<typeof postPresenceHeartbeat>>>;
export type PostPresenceHeartbeatMutationBody = BodyType<PresenceHeartbeatInput> | undefined;
export type PostPresenceHeartbeatMutationError = ErrorType<unknown>;
/**
* @summary Record coordinator presence heartbeat
*/
export declare const usePostPresenceHeartbeat: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof postPresenceHeartbeat>>, TError, {
        data?: BodyType<PresenceHeartbeatInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof postPresenceHeartbeat>>, TError, {
    data?: BodyType<PresenceHeartbeatInput>;
}, TContext>;
export declare const getGetPresenceUrl: () => string;
/**
 * @summary List currently online coordinators
 */
export declare const getPresence: (options?: Parameters<typeof customFetch>[1]) => Promise<PresenceList>;
export declare const getGetPresenceQueryKey: () => readonly ["/api/presence"];
export declare const getGetPresenceQueryOptions: <TData = Awaited<ReturnType<typeof getPresence>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresence>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPresence>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPresenceQueryResult = NonNullable<Awaited<ReturnType<typeof getPresence>>>;
export type GetPresenceQueryError = ErrorType<unknown>;
/**
 * @summary List currently online coordinators
 */
export declare function useGetPresence<TData = Awaited<ReturnType<typeof getPresence>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresence>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetPresenceStatsUrl: (params: GetPresenceStatsParams) => string;
/**
 * @summary Per-IP usage stats from page-visit history
 */
export declare const getPresenceStats: (params: GetPresenceStatsParams, options?: Parameters<typeof customFetch>[1]) => Promise<PresenceIpStats>;
export declare const getGetPresenceStatsQueryKey: (params?: GetPresenceStatsParams) => readonly ["/api/presence/stats", ...GetPresenceStatsParams[]];
export declare const getGetPresenceStatsQueryOptions: <TData = Awaited<ReturnType<typeof getPresenceStats>>, TError = ErrorType<unknown>>(params: GetPresenceStatsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresenceStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPresenceStats>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPresenceStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getPresenceStats>>>;
export type GetPresenceStatsQueryError = ErrorType<unknown>;
/**
 * @summary Per-IP usage stats from page-visit history
 */
export declare function useGetPresenceStats<TData = Awaited<ReturnType<typeof getPresenceStats>>, TError = ErrorType<unknown>>(params: GetPresenceStatsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPresenceStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getKickPresenceUrl: () => string;
/**
 * @summary Kick all sessions from an IP (revoke + remove presence)
 */
export declare const kickPresence: (presenceKickInput: PresenceKickInput, options?: Parameters<typeof customFetch>[1]) => Promise<PresenceKickResult>;
export declare const getKickPresenceMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof kickPresence>>, TError, {
        data: BodyType<PresenceKickInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof kickPresence>>, TError, {
    data: BodyType<PresenceKickInput>;
}, TContext>;
export type KickPresenceMutationResult = NonNullable<Awaited<ReturnType<typeof kickPresence>>>;
export type KickPresenceMutationBody = BodyType<PresenceKickInput>;
export type KickPresenceMutationError = ErrorType<unknown>;
/**
* @summary Kick all sessions from an IP (revoke + remove presence)
*/
export declare const useKickPresence: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof kickPresence>>, TError, {
        data: BodyType<PresenceKickInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof kickPresence>>, TError, {
    data: BodyType<PresenceKickInput>;
}, TContext>;
export declare const getPostBroadcastUrl: () => string;
/**
 * @summary Send a popup broadcast to coordinators
 */
export declare const postBroadcast: (broadcastInput: BroadcastInput, options?: Parameters<typeof customFetch>[1]) => Promise<Broadcast>;
export declare const getPostBroadcastMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof postBroadcast>>, TError, {
        data: BodyType<BroadcastInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof postBroadcast>>, TError, {
    data: BodyType<BroadcastInput>;
}, TContext>;
export type PostBroadcastMutationResult = NonNullable<Awaited<ReturnType<typeof postBroadcast>>>;
export type PostBroadcastMutationBody = BodyType<BroadcastInput>;
export type PostBroadcastMutationError = ErrorType<unknown>;
/**
* @summary Send a popup broadcast to coordinators
*/
export declare const usePostBroadcast: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof postBroadcast>>, TError, {
        data: BodyType<BroadcastInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof postBroadcast>>, TError, {
    data: BodyType<BroadcastInput>;
}, TContext>;
export declare const getGetMyBroadcastsUrl: () => string;
/**
 * @summary List unacknowledged active popups for this session
 */
export declare const getMyBroadcasts: (options?: Parameters<typeof customFetch>[1]) => Promise<BroadcastList>;
export declare const getGetMyBroadcastsQueryKey: () => readonly ["/api/broadcasts/mine"];
export declare const getGetMyBroadcastsQueryOptions: <TData = Awaited<ReturnType<typeof getMyBroadcasts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyBroadcasts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMyBroadcasts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMyBroadcastsQueryResult = NonNullable<Awaited<ReturnType<typeof getMyBroadcasts>>>;
export type GetMyBroadcastsQueryError = ErrorType<unknown>;
/**
 * @summary List unacknowledged active popups for this session
 */
export declare function useGetMyBroadcasts<TData = Awaited<ReturnType<typeof getMyBroadcasts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMyBroadcasts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetBroadcastCommandsUrl: () => string;
/**
 * @summary List unexpired big-screen commands (public; the display needs no login)
 */
export declare const getBroadcastCommands: (options?: Parameters<typeof customFetch>[1]) => Promise<BroadcastList>;
export declare const getGetBroadcastCommandsQueryKey: () => readonly ["/api/broadcasts/commands"];
export declare const getGetBroadcastCommandsQueryOptions: <TData = Awaited<ReturnType<typeof getBroadcastCommands>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBroadcastCommands>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getBroadcastCommands>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetBroadcastCommandsQueryResult = NonNullable<Awaited<ReturnType<typeof getBroadcastCommands>>>;
export type GetBroadcastCommandsQueryError = ErrorType<unknown>;
/**
 * @summary List unexpired big-screen commands (public; the display needs no login)
 */
export declare function useGetBroadcastCommands<TData = Awaited<ReturnType<typeof getBroadcastCommands>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBroadcastCommands>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getAckBroadcastUrl: (broadcastId: string) => string;
/**
 * @summary Acknowledge a popup so it never shows again
 */
export declare const ackBroadcast: (broadcastId: string, options?: Parameters<typeof customFetch>[1]) => Promise<BroadcastAck>;
export declare const getAckBroadcastMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof ackBroadcast>>, TError, {
        broadcastId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof ackBroadcast>>, TError, {
    broadcastId: string;
}, TContext>;
export type AckBroadcastMutationResult = NonNullable<Awaited<ReturnType<typeof ackBroadcast>>>;
export type AckBroadcastMutationError = ErrorType<unknown>;
/**
* @summary Acknowledge a popup so it never shows again
*/
export declare const useAckBroadcast: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof ackBroadcast>>, TError, {
        broadcastId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof ackBroadcast>>, TError, {
    broadcastId: string;
}, TContext>;
export declare const getListApplicantsUrl: (params?: ListApplicantsParams) => string;
/**
 * @summary List applicants with filters and sorting
 */
export declare const listApplicants: (params?: ListApplicantsParams, options?: Parameters<typeof customFetch>[1]) => Promise<ApplicantList>;
export declare const getListApplicantsQueryKey: (params?: ListApplicantsParams) => readonly ["/api/applicants", ...ListApplicantsParams[]];
export declare const getListApplicantsQueryOptions: <TData = Awaited<ReturnType<typeof listApplicants>>, TError = ErrorType<unknown>>(params?: ListApplicantsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listApplicants>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listApplicants>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListApplicantsQueryResult = NonNullable<Awaited<ReturnType<typeof listApplicants>>>;
export type ListApplicantsQueryError = ErrorType<unknown>;
/**
 * @summary List applicants with filters and sorting
 */
export declare function useListApplicants<TData = Awaited<ReturnType<typeof listApplicants>>, TError = ErrorType<unknown>>(params?: ListApplicantsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listApplicants>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetApplicantUrl: (id: string) => string;
/**
 * @summary Get an applicant with transcript and notes
 */
export declare const getApplicant: (id: string, options?: Parameters<typeof customFetch>[1]) => Promise<Applicant>;
export declare const getGetApplicantQueryKey: (id: string) => readonly [`/api/applicants/${string}`];
export declare const getGetApplicantQueryOptions: <TData = Awaited<ReturnType<typeof getApplicant>>, TError = ErrorType<ErrorResponse>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getApplicant>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getApplicant>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetApplicantQueryResult = NonNullable<Awaited<ReturnType<typeof getApplicant>>>;
export type GetApplicantQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get an applicant with transcript and notes
 */
export declare function useGetApplicant<TData = Awaited<ReturnType<typeof getApplicant>>, TError = ErrorType<ErrorResponse>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getApplicant>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateApplicantUrl: (id: string) => string;
/**
 * @summary Update ranking, category, status, or notes
 */
export declare const updateApplicant: (id: string, applicantUpdate: ApplicantUpdate, options?: Parameters<typeof customFetch>[1]) => Promise<Applicant>;
export declare const getUpdateApplicantMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateApplicant>>, TError, {
        id: string;
        data: BodyType<ApplicantUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateApplicant>>, TError, {
    id: string;
    data: BodyType<ApplicantUpdate>;
}, TContext>;
export type UpdateApplicantMutationResult = NonNullable<Awaited<ReturnType<typeof updateApplicant>>>;
export type UpdateApplicantMutationBody = BodyType<ApplicantUpdate>;
export type UpdateApplicantMutationError = ErrorType<unknown>;
/**
* @summary Update ranking, category, status, or notes
*/
export declare const useUpdateApplicant: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateApplicant>>, TError, {
        id: string;
        data: BodyType<ApplicantUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateApplicant>>, TError, {
    id: string;
    data: BodyType<ApplicantUpdate>;
}, TContext>;
export declare const getDeleteApplicantUrl: (id: string) => string;
/**
 * @summary Delete an applicant permanently
 */
export declare const deleteApplicant: (id: string, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeleteApplicantMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteApplicant>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteApplicant>>, TError, {
    id: string;
}, TContext>;
export type DeleteApplicantMutationResult = NonNullable<Awaited<ReturnType<typeof deleteApplicant>>>;
export type DeleteApplicantMutationError = ErrorType<ErrorResponse>;
/**
* @summary Delete an applicant permanently
*/
export declare const useDeleteApplicant: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteApplicant>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteApplicant>>, TError, {
    id: string;
}, TContext>;
export declare const getRegenerateApplicantUrl: (id: string) => string;
/**
 * @summary Regenerate AI score, recommendation, and readout from the transcript
 */
export declare const regenerateApplicant: (id: string, options?: Parameters<typeof customFetch>[1]) => Promise<Applicant>;
export declare const getRegenerateApplicantMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof regenerateApplicant>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof regenerateApplicant>>, TError, {
    id: string;
}, TContext>;
export type RegenerateApplicantMutationResult = NonNullable<Awaited<ReturnType<typeof regenerateApplicant>>>;
export type RegenerateApplicantMutationError = ErrorType<ErrorResponse>;
/**
* @summary Regenerate AI score, recommendation, and readout from the transcript
*/
export declare const useRegenerateApplicant: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof regenerateApplicant>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof regenerateApplicant>>, TError, {
    id: string;
}, TContext>;
export declare const getCommitImportUrl: () => string;
/**
 * @summary Commit a validated CSV import
 */
export declare const commitImport: (importInput: ImportInput, options?: Parameters<typeof customFetch>[1]) => Promise<ImportResult>;
export declare const getCommitImportMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof commitImport>>, TError, {
        data: BodyType<ImportInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof commitImport>>, TError, {
    data: BodyType<ImportInput>;
}, TContext>;
export type CommitImportMutationResult = NonNullable<Awaited<ReturnType<typeof commitImport>>>;
export type CommitImportMutationBody = BodyType<ImportInput>;
export type CommitImportMutationError = ErrorType<unknown>;
/**
* @summary Commit a validated CSV import
*/
export declare const useCommitImport: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof commitImport>>, TError, {
        data: BodyType<ImportInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof commitImport>>, TError, {
    data: BodyType<ImportInput>;
}, TContext>;
export declare const getPreviewImportUrl: () => string;
/**
 * @summary Preview a roster import and compare it with stored applicants
 */
export declare const previewImport: (importInput: ImportInput, options?: Parameters<typeof customFetch>[1]) => Promise<ImportPreview>;
export declare const getPreviewImportMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof previewImport>>, TError, {
        data: BodyType<ImportInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof previewImport>>, TError, {
    data: BodyType<ImportInput>;
}, TContext>;
export type PreviewImportMutationResult = NonNullable<Awaited<ReturnType<typeof previewImport>>>;
export type PreviewImportMutationBody = BodyType<ImportInput>;
export type PreviewImportMutationError = ErrorType<unknown>;
/**
* @summary Preview a roster import and compare it with stored applicants
*/
export declare const usePreviewImport: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof previewImport>>, TError, {
        data: BodyType<ImportInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof previewImport>>, TError, {
    data: BodyType<ImportInput>;
}, TContext>;
export declare const getListImportHistoryUrl: () => string;
/**
 * @summary List previous roster imports and their diffs
 */
export declare const listImportHistory: (options?: Parameters<typeof customFetch>[1]) => Promise<ImportHistory>;
export declare const getListImportHistoryQueryKey: () => readonly ["/api/imports/history"];
export declare const getListImportHistoryQueryOptions: <TData = Awaited<ReturnType<typeof listImportHistory>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listImportHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listImportHistory>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListImportHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof listImportHistory>>>;
export type ListImportHistoryQueryError = ErrorType<unknown>;
/**
 * @summary List previous roster imports and their diffs
 */
export declare function useListImportHistory<TData = Awaited<ReturnType<typeof listImportHistory>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listImportHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getRequestUploadUrlUrl: () => string;
/**
 * @summary Request a private CSV upload URL
 */
export declare const requestUploadUrl: (uploadInput: UploadInput, options?: Parameters<typeof customFetch>[1]) => Promise<UploadResponse>;
export declare const getRequestUploadUrlMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
        data: BodyType<UploadInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
    data: BodyType<UploadInput>;
}, TContext>;
export type RequestUploadUrlMutationResult = NonNullable<Awaited<ReturnType<typeof requestUploadUrl>>>;
export type RequestUploadUrlMutationBody = BodyType<UploadInput>;
export type RequestUploadUrlMutationError = ErrorType<unknown>;
/**
* @summary Request a private CSV upload URL
*/
export declare const useRequestUploadUrl: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
        data: BodyType<UploadInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
    data: BodyType<UploadInput>;
}, TContext>;
export declare const getGetQueueUrl: () => string;
/**
 * @summary Get the current interview queue and active applicants
 */
export declare const getQueue: (options?: Parameters<typeof customFetch>[1]) => Promise<QueueState>;
export declare const getGetQueueQueryKey: () => readonly ["/api/queue"];
export declare const getGetQueueQueryOptions: <TData = Awaited<ReturnType<typeof getQueue>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQueue>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getQueue>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetQueueQueryResult = NonNullable<Awaited<ReturnType<typeof getQueue>>>;
export type GetQueueQueryError = ErrorType<unknown>;
/**
 * @summary Get the current interview queue and active applicants
 */
export declare function useGetQueue<TData = Awaited<ReturnType<typeof getQueue>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getQueue>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getAdvanceQueueUrl: () => string;
/**
 * @summary Finish one applicant and advance that applicant only
 */
export declare const advanceQueue: (advanceQueueInput?: AdvanceQueueInput, options?: Parameters<typeof customFetch>[1]) => Promise<QueueState>;
export declare const getAdvanceQueueMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof advanceQueue>>, TError, {
        data?: BodyType<AdvanceQueueInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof advanceQueue>>, TError, {
    data?: BodyType<AdvanceQueueInput>;
}, TContext>;
export type AdvanceQueueMutationResult = NonNullable<Awaited<ReturnType<typeof advanceQueue>>>;
export type AdvanceQueueMutationBody = BodyType<AdvanceQueueInput> | undefined;
export type AdvanceQueueMutationError = ErrorType<unknown>;
/**
* @summary Finish one applicant and advance that applicant only
*/
export declare const useAdvanceQueue: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof advanceQueue>>, TError, {
        data?: BodyType<AdvanceQueueInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof advanceQueue>>, TError, {
    data?: BodyType<AdvanceQueueInput>;
}, TContext>;
export declare const getUpdateQueueSettingsUrl: () => string;
/**
 * @summary Update interviewer labels used by the queue and display
 */
export declare const updateQueueSettings: (queueSettingsInput: QueueSettingsInput, options?: Parameters<typeof customFetch>[1]) => Promise<QueueState>;
export declare const getUpdateQueueSettingsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateQueueSettings>>, TError, {
        data: BodyType<QueueSettingsInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateQueueSettings>>, TError, {
    data: BodyType<QueueSettingsInput>;
}, TContext>;
export type UpdateQueueSettingsMutationResult = NonNullable<Awaited<ReturnType<typeof updateQueueSettings>>>;
export type UpdateQueueSettingsMutationBody = BodyType<QueueSettingsInput>;
export type UpdateQueueSettingsMutationError = ErrorType<unknown>;
/**
* @summary Update interviewer labels used by the queue and display
*/
export declare const useUpdateQueueSettings: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateQueueSettings>>, TError, {
        data: BodyType<QueueSettingsInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateQueueSettings>>, TError, {
    data: BodyType<QueueSettingsInput>;
}, TContext>;
export declare const getResetQueueUrl: () => string;
/**
 * @summary Reset interview progress without deleting applicant data
 */
export declare const resetQueue: (options?: Parameters<typeof customFetch>[1]) => Promise<QueueState>;
export declare const getResetQueueMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof resetQueue>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof resetQueue>>, TError, void, TContext>;
export type ResetQueueMutationResult = NonNullable<Awaited<ReturnType<typeof resetQueue>>>;
export type ResetQueueMutationError = ErrorType<unknown>;
/**
* @summary Reset interview progress without deleting applicant data
*/
export declare const useResetQueue: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof resetQueue>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof resetQueue>>, TError, void, TContext>;
export declare const getGetInterviewChatUrl: (params?: GetInterviewChatParams) => string;
/**
 * @summary Get persisted interviewer chat
 */
export declare const getInterviewChat: (params?: GetInterviewChatParams, options?: Parameters<typeof customFetch>[1]) => Promise<InterviewChat>;
export declare const getGetInterviewChatQueryKey: (params?: GetInterviewChatParams) => readonly ["/api/queue/chat", ...GetInterviewChatParams[]];
export declare const getGetInterviewChatQueryOptions: <TData = Awaited<ReturnType<typeof getInterviewChat>>, TError = ErrorType<unknown>>(params?: GetInterviewChatParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getInterviewChat>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getInterviewChat>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetInterviewChatQueryResult = NonNullable<Awaited<ReturnType<typeof getInterviewChat>>>;
export type GetInterviewChatQueryError = ErrorType<unknown>;
/**
 * @summary Get persisted interviewer chat
 */
export declare function useGetInterviewChat<TData = Awaited<ReturnType<typeof getInterviewChat>>, TError = ErrorType<unknown>>(params?: GetInterviewChatParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getInterviewChat>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getSendInterviewChatUrl: () => string;
/**
 * @summary Send a message to the other interviewer
 */
export declare const sendInterviewChat: (interviewChatInput: InterviewChatInput, options?: Parameters<typeof customFetch>[1]) => Promise<InterviewChatMessage>;
export declare const getSendInterviewChatMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof sendInterviewChat>>, TError, {
        data: BodyType<InterviewChatInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof sendInterviewChat>>, TError, {
    data: BodyType<InterviewChatInput>;
}, TContext>;
export type SendInterviewChatMutationResult = NonNullable<Awaited<ReturnType<typeof sendInterviewChat>>>;
export type SendInterviewChatMutationBody = BodyType<InterviewChatInput>;
export type SendInterviewChatMutationError = ErrorType<unknown>;
/**
* @summary Send a message to the other interviewer
*/
export declare const useSendInterviewChat: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof sendInterviewChat>>, TError, {
        data: BodyType<InterviewChatInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof sendInterviewChat>>, TError, {
    data: BodyType<InterviewChatInput>;
}, TContext>;
export declare const getReorderQueueUrl: () => string;
/**
 * @summary Save the interview order
 */
export declare const reorderQueue: (reorderQueueInput: ReorderQueueInput, options?: Parameters<typeof customFetch>[1]) => Promise<QueueState>;
export declare const getReorderQueueMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reorderQueue>>, TError, {
        data: BodyType<ReorderQueueInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof reorderQueue>>, TError, {
    data: BodyType<ReorderQueueInput>;
}, TContext>;
export type ReorderQueueMutationResult = NonNullable<Awaited<ReturnType<typeof reorderQueue>>>;
export type ReorderQueueMutationBody = BodyType<ReorderQueueInput>;
export type ReorderQueueMutationError = ErrorType<unknown>;
/**
* @summary Save the interview order
*/
export declare const useReorderQueue: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reorderQueue>>, TError, {
        data: BodyType<ReorderQueueInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof reorderQueue>>, TError, {
    data: BodyType<ReorderQueueInput>;
}, TContext>;
export declare const getCallbackQueueUrl: () => string;
/**
 * @summary Recall a finished applicant to the front of the queue
 */
export declare const callbackQueue: (queueCallbackInput: QueueCallbackInput, options?: Parameters<typeof customFetch>[1]) => Promise<QueueState>;
export declare const getCallbackQueueMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof callbackQueue>>, TError, {
        data: BodyType<QueueCallbackInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof callbackQueue>>, TError, {
    data: BodyType<QueueCallbackInput>;
}, TContext>;
export type CallbackQueueMutationResult = NonNullable<Awaited<ReturnType<typeof callbackQueue>>>;
export type CallbackQueueMutationBody = BodyType<QueueCallbackInput>;
export type CallbackQueueMutationError = ErrorType<unknown>;
/**
* @summary Recall a finished applicant to the front of the queue
*/
export declare const useCallbackQueue: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof callbackQueue>>, TError, {
        data: BodyType<QueueCallbackInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof callbackQueue>>, TError, {
    data: BodyType<QueueCallbackInput>;
}, TContext>;
export declare const getGetDisplayStateUrl: () => string;
/**
 * @summary Get sanitized big-screen state
 */
export declare const getDisplayState: (options?: Parameters<typeof customFetch>[1]) => Promise<DisplayState>;
export declare const getGetDisplayStateQueryKey: () => readonly ["/api/display/state"];
export declare const getGetDisplayStateQueryOptions: <TData = Awaited<ReturnType<typeof getDisplayState>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDisplayState>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDisplayState>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDisplayStateQueryResult = NonNullable<Awaited<ReturnType<typeof getDisplayState>>>;
export type GetDisplayStateQueryError = ErrorType<unknown>;
/**
 * @summary Get sanitized big-screen state
 */
export declare function useGetDisplayState<TData = Awaited<ReturnType<typeof getDisplayState>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDisplayState>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetDisplaySettingsUrl: () => string;
/**
 * @summary Get big-screen text and announcement settings
 */
export declare const getDisplaySettings: (options?: Parameters<typeof customFetch>[1]) => Promise<DisplaySettings>;
export declare const getGetDisplaySettingsQueryKey: () => readonly ["/api/display/settings"];
export declare const getGetDisplaySettingsQueryOptions: <TData = Awaited<ReturnType<typeof getDisplaySettings>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDisplaySettings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDisplaySettings>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDisplaySettingsQueryResult = NonNullable<Awaited<ReturnType<typeof getDisplaySettings>>>;
export type GetDisplaySettingsQueryError = ErrorType<unknown>;
/**
 * @summary Get big-screen text and announcement settings
 */
export declare function useGetDisplaySettings<TData = Awaited<ReturnType<typeof getDisplaySettings>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDisplaySettings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateDisplaySettingsUrl: () => string;
/**
 * @summary Update big-screen text, name pills, and announcements
 */
export declare const updateDisplaySettings: (displaySettingsInput: DisplaySettingsInput, options?: Parameters<typeof customFetch>[1]) => Promise<DisplaySettings>;
export declare const getUpdateDisplaySettingsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateDisplaySettings>>, TError, {
        data: BodyType<DisplaySettingsInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateDisplaySettings>>, TError, {
    data: BodyType<DisplaySettingsInput>;
}, TContext>;
export type UpdateDisplaySettingsMutationResult = NonNullable<Awaited<ReturnType<typeof updateDisplaySettings>>>;
export type UpdateDisplaySettingsMutationBody = BodyType<DisplaySettingsInput>;
export type UpdateDisplaySettingsMutationError = ErrorType<unknown>;
/**
* @summary Update big-screen text, name pills, and announcements
*/
export declare const useUpdateDisplaySettings: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateDisplaySettings>>, TError, {
        data: BodyType<DisplaySettingsInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateDisplaySettings>>, TError, {
    data: BodyType<DisplaySettingsInput>;
}, TContext>;
export declare const getGetSeatingSettingsUrl: () => string;
/**
 * @summary Get seating chart dimensions
 */
export declare const getSeatingSettings: (options?: Parameters<typeof customFetch>[1]) => Promise<SeatingSettings>;
export declare const getGetSeatingSettingsQueryKey: () => readonly ["/api/seating/settings"];
export declare const getGetSeatingSettingsQueryOptions: <TData = Awaited<ReturnType<typeof getSeatingSettings>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSeatingSettings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getSeatingSettings>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetSeatingSettingsQueryResult = NonNullable<Awaited<ReturnType<typeof getSeatingSettings>>>;
export type GetSeatingSettingsQueryError = ErrorType<unknown>;
/**
 * @summary Get seating chart dimensions
 */
export declare function useGetSeatingSettings<TData = Awaited<ReturnType<typeof getSeatingSettings>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSeatingSettings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateSeatingSettingsUrl: () => string;
/**
 * @summary Resize the seating chart (out-of-bounds seats are cleared)
 */
export declare const updateSeatingSettings: (seatingSettingsInput: SeatingSettingsInput, options?: Parameters<typeof customFetch>[1]) => Promise<SeatingSettings>;
export declare const getUpdateSeatingSettingsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSeatingSettings>>, TError, {
        data: BodyType<SeatingSettingsInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateSeatingSettings>>, TError, {
    data: BodyType<SeatingSettingsInput>;
}, TContext>;
export type UpdateSeatingSettingsMutationResult = NonNullable<Awaited<ReturnType<typeof updateSeatingSettings>>>;
export type UpdateSeatingSettingsMutationBody = BodyType<SeatingSettingsInput>;
export type UpdateSeatingSettingsMutationError = ErrorType<unknown>;
/**
* @summary Resize the seating chart (out-of-bounds seats are cleared)
*/
export declare const useUpdateSeatingSettings: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSeatingSettings>>, TError, {
        data: BodyType<SeatingSettingsInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateSeatingSettings>>, TError, {
    data: BodyType<SeatingSettingsInput>;
}, TContext>;
export declare const getAssignSeatUrl: () => string;
/**
 * @summary Seat an applicant (occupant swaps into their old seat; row/col -1 unseats)
 */
export declare const assignSeat: (seatingAssignInput: SeatingAssignInput, options?: Parameters<typeof customFetch>[1]) => Promise<Applicant>;
export declare const getAssignSeatMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof assignSeat>>, TError, {
        data: BodyType<SeatingAssignInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof assignSeat>>, TError, {
    data: BodyType<SeatingAssignInput>;
}, TContext>;
export type AssignSeatMutationResult = NonNullable<Awaited<ReturnType<typeof assignSeat>>>;
export type AssignSeatMutationBody = BodyType<SeatingAssignInput>;
export type AssignSeatMutationError = ErrorType<unknown>;
/**
* @summary Seat an applicant (occupant swaps into their old seat; row/col -1 unseats)
*/
export declare const useAssignSeat: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof assignSeat>>, TError, {
        data: BodyType<SeatingAssignInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof assignSeat>>, TError, {
    data: BodyType<SeatingAssignInput>;
}, TContext>;
export declare const getAskAssistantUrl: () => string;
/**
 * @summary Ask the AI assistant about the current applicants
 */
export declare const askAssistant: (assistantInput: AssistantInput, options?: Parameters<typeof customFetch>[1]) => Promise<AssistantResponse>;
export declare const getAskAssistantMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof askAssistant>>, TError, {
        data: BodyType<AssistantInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof askAssistant>>, TError, {
    data: BodyType<AssistantInput>;
}, TContext>;
export type AskAssistantMutationResult = NonNullable<Awaited<ReturnType<typeof askAssistant>>>;
export type AskAssistantMutationBody = BodyType<AssistantInput>;
export type AskAssistantMutationError = ErrorType<unknown>;
/**
* @summary Ask the AI assistant about the current applicants
*/
export declare const useAskAssistant: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof askAssistant>>, TError, {
        data: BodyType<AssistantInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof askAssistant>>, TError, {
    data: BodyType<AssistantInput>;
}, TContext>;
export declare const getGenerateAssistantImageUrl: () => string;
/**
 * @summary Generate an AI image from a coordinator prompt (keyless provider)
 */
export declare const generateAssistantImage: (generateImageInput: GenerateImageInput, options?: Parameters<typeof customFetch>[1]) => Promise<GenerateImageResult>;
export declare const getGenerateAssistantImageMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateAssistantImage>>, TError, {
        data: BodyType<GenerateImageInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateAssistantImage>>, TError, {
    data: BodyType<GenerateImageInput>;
}, TContext>;
export type GenerateAssistantImageMutationResult = NonNullable<Awaited<ReturnType<typeof generateAssistantImage>>>;
export type GenerateAssistantImageMutationBody = BodyType<GenerateImageInput>;
export type GenerateAssistantImageMutationError = ErrorType<unknown>;
/**
* @summary Generate an AI image from a coordinator prompt (keyless provider)
*/
export declare const useGenerateAssistantImage: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateAssistantImage>>, TError, {
        data: BodyType<GenerateImageInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateAssistantImage>>, TError, {
    data: BodyType<GenerateImageInput>;
}, TContext>;
export declare const getListDashboardChartsUrl: () => string;
/**
 * @summary List saved custom dashboard charts
 */
export declare const listDashboardCharts: (options?: Parameters<typeof customFetch>[1]) => Promise<DashboardChartList>;
export declare const getListDashboardChartsQueryKey: () => readonly ["/api/dashboard/charts"];
export declare const getListDashboardChartsQueryOptions: <TData = Awaited<ReturnType<typeof listDashboardCharts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listDashboardCharts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listDashboardCharts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListDashboardChartsQueryResult = NonNullable<Awaited<ReturnType<typeof listDashboardCharts>>>;
export type ListDashboardChartsQueryError = ErrorType<unknown>;
/**
 * @summary List saved custom dashboard charts
 */
export declare function useListDashboardCharts<TData = Awaited<ReturnType<typeof listDashboardCharts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listDashboardCharts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateDashboardChartUrl: () => string;
/**
 * @summary Save a custom dashboard chart
 */
export declare const createDashboardChart: (dashboardChartInput: DashboardChartInput, options?: Parameters<typeof customFetch>[1]) => Promise<DashboardChart>;
export declare const getCreateDashboardChartMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createDashboardChart>>, TError, {
        data: BodyType<DashboardChartInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createDashboardChart>>, TError, {
    data: BodyType<DashboardChartInput>;
}, TContext>;
export type CreateDashboardChartMutationResult = NonNullable<Awaited<ReturnType<typeof createDashboardChart>>>;
export type CreateDashboardChartMutationBody = BodyType<DashboardChartInput>;
export type CreateDashboardChartMutationError = ErrorType<unknown>;
/**
* @summary Save a custom dashboard chart
*/
export declare const useCreateDashboardChart: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createDashboardChart>>, TError, {
        data: BodyType<DashboardChartInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createDashboardChart>>, TError, {
    data: BodyType<DashboardChartInput>;
}, TContext>;
export declare const getUpdateDashboardChartUrl: (chartId: string) => string;
/**
 * @summary Update a custom dashboard chart
 */
export declare const updateDashboardChart: (chartId: string, dashboardChartUpdate: DashboardChartUpdate, options?: Parameters<typeof customFetch>[1]) => Promise<DashboardChart>;
export declare const getUpdateDashboardChartMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateDashboardChart>>, TError, {
        chartId: string;
        data: BodyType<DashboardChartUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateDashboardChart>>, TError, {
    chartId: string;
    data: BodyType<DashboardChartUpdate>;
}, TContext>;
export type UpdateDashboardChartMutationResult = NonNullable<Awaited<ReturnType<typeof updateDashboardChart>>>;
export type UpdateDashboardChartMutationBody = BodyType<DashboardChartUpdate>;
export type UpdateDashboardChartMutationError = ErrorType<ErrorResponse>;
/**
* @summary Update a custom dashboard chart
*/
export declare const useUpdateDashboardChart: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateDashboardChart>>, TError, {
        chartId: string;
        data: BodyType<DashboardChartUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateDashboardChart>>, TError, {
    chartId: string;
    data: BodyType<DashboardChartUpdate>;
}, TContext>;
export declare const getDeleteDashboardChartUrl: (chartId: string) => string;
/**
 * @summary Delete a custom dashboard chart
 */
export declare const deleteDashboardChart: (chartId: string, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeleteDashboardChartMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteDashboardChart>>, TError, {
        chartId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteDashboardChart>>, TError, {
    chartId: string;
}, TContext>;
export type DeleteDashboardChartMutationResult = NonNullable<Awaited<ReturnType<typeof deleteDashboardChart>>>;
export type DeleteDashboardChartMutationError = ErrorType<ErrorResponse>;
/**
* @summary Delete a custom dashboard chart
*/
export declare const useDeleteDashboardChart: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteDashboardChart>>, TError, {
        chartId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteDashboardChart>>, TError, {
    chartId: string;
}, TContext>;
export declare const getListSnapshotsUrl: () => string;
/**
 * @summary List data snapshots (newest first, no payloads)
 */
export declare const listSnapshots: (options?: Parameters<typeof customFetch>[1]) => Promise<SnapshotList>;
export declare const getListSnapshotsQueryKey: () => readonly ["/api/snapshots"];
export declare const getListSnapshotsQueryOptions: <TData = Awaited<ReturnType<typeof listSnapshots>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listSnapshots>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listSnapshots>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListSnapshotsQueryResult = NonNullable<Awaited<ReturnType<typeof listSnapshots>>>;
export type ListSnapshotsQueryError = ErrorType<unknown>;
/**
 * @summary List data snapshots (newest first, no payloads)
 */
export declare function useListSnapshots<TData = Awaited<ReturnType<typeof listSnapshots>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listSnapshots>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateSnapshotUrl: () => string;
/**
 * @summary Capture a snapshot of the current data
 */
export declare const createSnapshot: (snapshotInput?: SnapshotInput, options?: Parameters<typeof customFetch>[1]) => Promise<Snapshot>;
export declare const getCreateSnapshotMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createSnapshot>>, TError, {
        data?: BodyType<SnapshotInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createSnapshot>>, TError, {
    data?: BodyType<SnapshotInput>;
}, TContext>;
export type CreateSnapshotMutationResult = NonNullable<Awaited<ReturnType<typeof createSnapshot>>>;
export type CreateSnapshotMutationBody = BodyType<SnapshotInput> | undefined;
export type CreateSnapshotMutationError = ErrorType<unknown>;
/**
* @summary Capture a snapshot of the current data
*/
export declare const useCreateSnapshot: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createSnapshot>>, TError, {
        data?: BodyType<SnapshotInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createSnapshot>>, TError, {
    data?: BodyType<SnapshotInput>;
}, TContext>;
export declare const getRestoreSnapshotUrl: (snapshotId: string) => string;
/**
 * @summary Restore a snapshot (current state is saved first as a new snapshot)
 */
export declare const restoreSnapshot: (snapshotId: string, snapshotRestoreInput?: SnapshotRestoreInput, options?: Parameters<typeof customFetch>[1]) => Promise<SnapshotRestoreResult>;
export declare const getRestoreSnapshotMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof restoreSnapshot>>, TError, {
        snapshotId: string;
        data?: BodyType<SnapshotRestoreInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof restoreSnapshot>>, TError, {
    snapshotId: string;
    data?: BodyType<SnapshotRestoreInput>;
}, TContext>;
export type RestoreSnapshotMutationResult = NonNullable<Awaited<ReturnType<typeof restoreSnapshot>>>;
export type RestoreSnapshotMutationBody = BodyType<SnapshotRestoreInput> | undefined;
export type RestoreSnapshotMutationError = ErrorType<ErrorResponse>;
/**
* @summary Restore a snapshot (current state is saved first as a new snapshot)
*/
export declare const useRestoreSnapshot: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof restoreSnapshot>>, TError, {
        snapshotId: string;
        data?: BodyType<SnapshotRestoreInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof restoreSnapshot>>, TError, {
    snapshotId: string;
    data?: BodyType<SnapshotRestoreInput>;
}, TContext>;
export declare const getGetAssistantHistoryUrl: () => string;
/**
 * @summary Get persisted assistant conversations
 */
export declare const getAssistantHistory: (options?: Parameters<typeof customFetch>[1]) => Promise<AssistantHistory>;
export declare const getGetAssistantHistoryQueryKey: () => readonly ["/api/assistant/history"];
export declare const getGetAssistantHistoryQueryOptions: <TData = Awaited<ReturnType<typeof getAssistantHistory>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAssistantHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAssistantHistory>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAssistantHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof getAssistantHistory>>>;
export type GetAssistantHistoryQueryError = ErrorType<unknown>;
/**
 * @summary Get persisted assistant conversations
 */
export declare function useGetAssistantHistory<TData = Awaited<ReturnType<typeof getAssistantHistory>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAssistantHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getClearAssistantHistoryUrl: () => string;
/**
 * @summary Clear the persisted assistant conversation
 */
export declare const clearAssistantHistory: (options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getClearAssistantHistoryMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof clearAssistantHistory>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof clearAssistantHistory>>, TError, void, TContext>;
export type ClearAssistantHistoryMutationResult = NonNullable<Awaited<ReturnType<typeof clearAssistantHistory>>>;
export type ClearAssistantHistoryMutationError = ErrorType<unknown>;
/**
* @summary Clear the persisted assistant conversation
*/
export declare const useClearAssistantHistory: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof clearAssistantHistory>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof clearAssistantHistory>>, TError, void, TContext>;
export declare const getGetAssistantConfigUrl: () => string;
/**
 * @summary Get AI assistant model configuration
 */
export declare const getAssistantConfig: (options?: Parameters<typeof customFetch>[1]) => Promise<AssistantConfig>;
export declare const getGetAssistantConfigQueryKey: () => readonly ["/api/assistant/config"];
export declare const getGetAssistantConfigQueryOptions: <TData = Awaited<ReturnType<typeof getAssistantConfig>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAssistantConfig>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAssistantConfig>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAssistantConfigQueryResult = NonNullable<Awaited<ReturnType<typeof getAssistantConfig>>>;
export type GetAssistantConfigQueryError = ErrorType<unknown>;
/**
 * @summary Get AI assistant model configuration
 */
export declare function useGetAssistantConfig<TData = Awaited<ReturnType<typeof getAssistantConfig>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAssistantConfig>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListAssistantConversationsUrl: () => string;
/**
 * @summary List saved assistant conversations
 */
export declare const listAssistantConversations: (options?: Parameters<typeof customFetch>[1]) => Promise<AssistantConversationList>;
export declare const getListAssistantConversationsQueryKey: () => readonly ["/api/assistant/conversations"];
export declare const getListAssistantConversationsQueryOptions: <TData = Awaited<ReturnType<typeof listAssistantConversations>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAssistantConversations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAssistantConversations>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAssistantConversationsQueryResult = NonNullable<Awaited<ReturnType<typeof listAssistantConversations>>>;
export type ListAssistantConversationsQueryError = ErrorType<unknown>;
/**
 * @summary List saved assistant conversations
 */
export declare function useListAssistantConversations<TData = Awaited<ReturnType<typeof listAssistantConversations>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAssistantConversations>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateAssistantConversationUrl: () => string;
/**
 * @summary Create an assistant conversation
 */
export declare const createAssistantConversation: (assistantConversationInput?: AssistantConversationInput, options?: Parameters<typeof customFetch>[1]) => Promise<AssistantConversation>;
export declare const getCreateAssistantConversationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAssistantConversation>>, TError, {
        data?: BodyType<AssistantConversationInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createAssistantConversation>>, TError, {
    data?: BodyType<AssistantConversationInput>;
}, TContext>;
export type CreateAssistantConversationMutationResult = NonNullable<Awaited<ReturnType<typeof createAssistantConversation>>>;
export type CreateAssistantConversationMutationBody = BodyType<AssistantConversationInput> | undefined;
export type CreateAssistantConversationMutationError = ErrorType<unknown>;
/**
* @summary Create an assistant conversation
*/
export declare const useCreateAssistantConversation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAssistantConversation>>, TError, {
        data?: BodyType<AssistantConversationInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createAssistantConversation>>, TError, {
    data?: BodyType<AssistantConversationInput>;
}, TContext>;
export declare const getRenameAssistantConversationUrl: (conversationId: string) => string;
/**
 * @summary Rename an assistant conversation
 */
export declare const renameAssistantConversation: (conversationId: string, assistantConversationUpdate: AssistantConversationUpdate, options?: Parameters<typeof customFetch>[1]) => Promise<AssistantConversation>;
export declare const getRenameAssistantConversationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof renameAssistantConversation>>, TError, {
        conversationId: string;
        data: BodyType<AssistantConversationUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof renameAssistantConversation>>, TError, {
    conversationId: string;
    data: BodyType<AssistantConversationUpdate>;
}, TContext>;
export type RenameAssistantConversationMutationResult = NonNullable<Awaited<ReturnType<typeof renameAssistantConversation>>>;
export type RenameAssistantConversationMutationBody = BodyType<AssistantConversationUpdate>;
export type RenameAssistantConversationMutationError = ErrorType<unknown>;
/**
* @summary Rename an assistant conversation
*/
export declare const useRenameAssistantConversation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof renameAssistantConversation>>, TError, {
        conversationId: string;
        data: BodyType<AssistantConversationUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof renameAssistantConversation>>, TError, {
    conversationId: string;
    data: BodyType<AssistantConversationUpdate>;
}, TContext>;
export declare const getDeleteAssistantConversationUrl: (conversationId: string) => string;
/**
 * @summary Delete an assistant conversation
 */
export declare const deleteAssistantConversation: (conversationId: string, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeleteAssistantConversationMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAssistantConversation>>, TError, {
        conversationId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteAssistantConversation>>, TError, {
    conversationId: string;
}, TContext>;
export type DeleteAssistantConversationMutationResult = NonNullable<Awaited<ReturnType<typeof deleteAssistantConversation>>>;
export type DeleteAssistantConversationMutationError = ErrorType<unknown>;
/**
* @summary Delete an assistant conversation
*/
export declare const useDeleteAssistantConversation: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAssistantConversation>>, TError, {
        conversationId: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteAssistantConversation>>, TError, {
    conversationId: string;
}, TContext>;
export declare const getGetAssistantConversationMessagesUrl: (conversationId: string, params?: GetAssistantConversationMessagesParams) => string;
/**
 * @summary Get messages in an assistant conversation
 */
export declare const getAssistantConversationMessages: (conversationId: string, params?: GetAssistantConversationMessagesParams, options?: Parameters<typeof customFetch>[1]) => Promise<AssistantHistory>;
export declare const getGetAssistantConversationMessagesQueryKey: (conversationId: string, params?: GetAssistantConversationMessagesParams) => readonly [`/api/assistant/conversations/${string}/messages`, ...GetAssistantConversationMessagesParams[]];
export declare const getGetAssistantConversationMessagesQueryOptions: <TData = Awaited<ReturnType<typeof getAssistantConversationMessages>>, TError = ErrorType<unknown>>(conversationId: string, params?: GetAssistantConversationMessagesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAssistantConversationMessages>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAssistantConversationMessages>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAssistantConversationMessagesQueryResult = NonNullable<Awaited<ReturnType<typeof getAssistantConversationMessages>>>;
export type GetAssistantConversationMessagesQueryError = ErrorType<unknown>;
/**
 * @summary Get messages in an assistant conversation
 */
export declare function useGetAssistantConversationMessages<TData = Awaited<ReturnType<typeof getAssistantConversationMessages>>, TError = ErrorType<unknown>>(conversationId: string, params?: GetAssistantConversationMessagesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAssistantConversationMessages>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map