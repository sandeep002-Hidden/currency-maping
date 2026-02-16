import { IApiResponse } from '../types';

export function successResponse<T = any>(
    message: string,
    data?: T,
    meta?: any,
    requestId?: string
): IApiResponse<T> {
    return {
        success: true,
        message,
        data,
        meta,
        timestamp: new Date().toISOString(),
        requestId,
    };
}

export function errorResponse<T = any>(
    message: string,
    error?: string,
    data?: T,
    meta?: any,
    requestId?: string
): IApiResponse<T> {
    return {
        success: false,
        message,
        error,
        data,
        meta,
        timestamp: new Date().toISOString(),
        requestId,
    };
}


