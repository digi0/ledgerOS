from functools import lru_cache

import boto3
from botocore.client import Config

from app.config import get_settings


@lru_cache
def s3_client():
    s = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=s.s3_endpoint_url or None,
        aws_access_key_id=s.s3_access_key,
        aws_secret_access_key=s.s3_secret_key,
        region_name=s.s3_region,
        config=Config(signature_version="s3v4"),
    )


def ensure_bucket() -> None:
    s = get_settings()
    client = s3_client()
    existing = {b["Name"] for b in client.list_buckets().get("Buckets", [])}
    if s.s3_bucket not in existing:
        client.create_bucket(Bucket=s.s3_bucket)


def put_object(key: str, body: bytes, content_type: str = "application/octet-stream") -> str:
    s = get_settings()
    s3_client().put_object(Bucket=s.s3_bucket, Key=key, Body=body, ContentType=content_type)
    return f"s3://{s.s3_bucket}/{key}"


def get_object(key: str) -> bytes:
    s = get_settings()
    resp = s3_client().get_object(Bucket=s.s3_bucket, Key=key)
    return resp["Body"].read()
