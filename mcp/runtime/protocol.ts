export interface JsonRpcRequest {
    jsonrpc: "2.0";
    id: number;
    method: string;
    params?: unknown;
}

export interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: number;
    result?: unknown;
    error?: {
        code: number;
        message: string;
        data?: unknown;
    };
}

export interface JsonRpcNotification {
    jsonrpc: "2.0";
    method: string;
    params?: unknown;
}