CREATE DATABASE IF NOT EXISTS observability;

CREATE TABLE IF NOT EXISTS observability.logs (
    timestamp DateTime64(3),
    ingestion_timestamp DateTime64(3),
    request_id String,
    trace_id String,
    level LowCardinality(String),
    event LowCardinality(String),
    route LowCardinality(String),
    method LowCardinality(String),
    status UInt16,
    latency_ms UInt32,
    latency_bucket LowCardinality(String),
    error_type Nullable(String),
    downstream_calls String,
    payload_size Nullable(UInt32)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, route, status, request_id)
TTL timestamp + INTERVAL 1 DAY;

