export interface LogEvent {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: 'request.end';
  request_id: string;
  trace_id: string;
  route: string;
  method: string;
  status: number;
  latency_ms: number;
  latency_bucket: 'fast' | 'medium' | 'slow';
  error_type: string | null;
  downstream_calls?: DownstreamCall[];
  payload_size?: number;
}

export interface DownstreamCall {
  call_id: string;
  latency_ms: number;
  success: boolean;
  error_type?: string;
}

export interface RequestContextData {
  request_id: string;
  trace_id: string;
  route: string;
  method: string;
  startTime: number;
  status?: number;
  error_type?: string | null;
  downstream_calls?: DownstreamCall[];
  payload_size?: number;
}
