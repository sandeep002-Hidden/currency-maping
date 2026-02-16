export interface IApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    error?: string;
    meta?: any;
    timestamp?: string;
    requestId?: string;
}