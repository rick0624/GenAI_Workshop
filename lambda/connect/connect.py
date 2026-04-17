import json
import logging
import os
import re
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ["TABLE_NAME"]
DYNAMODB_ENDPOINT = os.environ.get("DYNAMODB_ENDPOINT")
CALLSIGN_RE = re.compile(r"^[a-zA-Z0-9_]{1,20}$")

dynamodb = boto3.resource(
    "dynamodb",
    **({"endpoint_url": DYNAMODB_ENDPOINT} if DYNAMODB_ENDPOINT else {}),
)
table = dynamodb.Table(TABLE_NAME)


def _broadcast_system_event(domain_name: str, stage: str, event_type: str, callsign: str, skip_id: str) -> None:
    """Push a system event (user_joined / user_left) to all connections except skip_id."""
    endpoint_url = f"https://{domain_name}/{stage}"
    apigw = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)

    payload = json.dumps({
        "type": "system",
        "event": event_type,
        "callsign": callsign,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }).encode("utf-8")

    # Paginate in case the table is large
    connections = []
    scan_kwargs: dict = {"ProjectionExpression": "connectionId"}
    while True:
        response = table.scan(**scan_kwargs)
        connections.extend(response["Items"])
        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    for conn in connections:
        cid = conn["connectionId"]
        if cid == skip_id:
            continue
        try:
            apigw.post_to_connection(ConnectionId=cid, Data=payload)
        except apigw.exceptions.GoneException:
            try:
                table.delete_item(Key={"connectionId": cid})
            except ClientError:
                pass
        except Exception as exc:
            logger.warning("Failed to notify %s: %s", cid, exc)


def handler(event: dict, _context) -> dict:
    try:
        ctx = event.get("requestContext", {})
        connection_id: str = ctx["connectionId"]
        domain_name: str = ctx.get("domainName", "")
        stage: str = ctx.get("stage", "")

        qs = event.get("queryStringParameters") or {}
        callsign: str = qs.get("callsign", "").strip()

        if not callsign or not CALLSIGN_RE.match(callsign):
            logger.warning("Invalid or missing callsign: %r", callsign)
            return {"statusCode": 400, "body": "Invalid or missing callsign"}

        table.put_item(Item={
            "connectionId": connection_id,
            "callsign": callsign,
            "connectedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        })
        logger.info("Connected: %s as %s", connection_id, callsign)

        # Best-effort: broadcast join event to everyone already in the room
        if domain_name and domain_name != "localhost":
            try:
                _broadcast_system_event(domain_name, stage, "user_joined", callsign, connection_id)
            except Exception as exc:
                logger.warning("Broadcast user_joined failed: %s", exc)

        return {"statusCode": 200, "body": "Connected"}

    except ClientError as exc:
        logger.error("DynamoDB error: %s", exc)
        return {"statusCode": 500, "body": "Internal server error"}
    except Exception as exc:
        logger.error("Unexpected error: %s", exc)
        return {"statusCode": 500, "body": "Internal server error"}
